const firebaseFunctions = require('./firebaseFunctions')
const misc = require('./miscFunctions');
const amazon = require('./amazonScraperFunctions')
const claude = require('./claudeFunctions')

const processBlogArticleFromBulk = async (keyWord, internalUrl, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, wordRange, citeSources) => {
    // const isWithinWordCount = await misc.doesUserHaveEnoughWords(currentUser, wordRange)

    // if (!isWithinWordCount) {
    //   res.status(500).send("Word Count Limit Hit")
    // }

    let jobId
    let context = ""
    if (!jobId) {
        jobId = -1
    }

    const articleType = "blog"

    context = await misc.doSerpResearch(keyWord, "")
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "context", context, articleType)
    outline = await amazon.generateOutlineClaude(keyWord, wordRange, context)
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
    console.log('outline: \n', outline)

    let finetune = ""

    finetuneChosen.textInputs.forEach(input => {
        finetune += input.body
    })

    try {
        finetune += await claude.generateFinetune(finetuneChosen.urls)
    } catch (error) {
        console.log('Error generating finetune ', error)
    }
    // context = await misc.getContextFromDb(currentUser, jobId)

    console.log('generating article')
    let updatedOutline
    try {
        updatedOutline = await amazon.generateArticleClaude(outline, keyWord, context, tone, pointOfView, citeSources, finetune);
    } catch (e) {
        throw new Error(e)
    }

    console.log('article generated now doing gemini article')

    console.log('gemini article generated')
    const wordCount = misc.countWords(updatedOutline)
    const updatedWordCount = await firebaseFunctions.decrementUserWordCount(currentUser, wordCount)
    console.log('word count: ', wordCount)
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", updatedOutline)
    //Outline will now contain each section filled in with data
    return updatedOutline
}

const processAmazonArticleFromBulk = async (keyWord, internalUrl, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, wordRange, citeSources, itemId, isAmazonArticle, amazonUrl, affiliate, numberOfProducts) => {
    const length = amazon.determineArticleLength(numberOfProducts)
    const isWithinWordCount = await misc.doesUserHaveEnoughWordsAmazon(currentUser, length)

    if (!isWithinWordCount) {
        return res.status(500).send("Word Count Limit Hit")
    }

    let jobId
    let context = ""
    if (!jobId) {
        jobId = -1
    }

    const articleType = "amazon"

    context = await amazon.performSearch(keyWord, amazonUrl, numberOfProducts, affiliate)
    // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "context", context, articleType)
    outline = await amazon.generateOutlineAmazon(keyWord, context)
    // jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
    console.log('outline generated')

    let finetune = ""

    finetuneChosen.textInputs.forEach(input => {
        finetune += input.body
    })

    try {
        finetune += await claude.generateFinetune(finetuneChosen.urls)
    } catch (error) {
        console.log('Error generating finetune ', error)
    }

    console.log('generating article')

    try {
        await amazon.generateAmazonArticle(outline, keyWord, context, tone, pointOfView, finetune);
    } catch (e) {
        throw new Error(e)
    }
    const wordCount = amazon.countWordsClaudeBlog(outline)
    const updatedWordCount = await firebaseFunctions.decrementUserWordCount(currentUser, wordCount)
    jobId = await firebaseFunctions.updateFirebaseJob(currentUser, jobId, "outline", outline, articleType)
    console.log('word count: ', wordCount)
    //Outline will now contain each section filled in with data
    console.log('outline:\n', outline)
    return outline
}

const processNextItem = async () => {
    let itemIdProcess

    try {
        const { keyWord, internalUrl, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, wordRange, citeSources, itemId, isAmazonArticle, amazonUrl, affiliate, numberOfProducts } = await firebaseFunctions.getNextItemFirebase()
        firebaseFunctions.markItemInProgress(itemId)
        itemIdProcess = itemId

        if (isAmazonArticle) {
            const article = await processAmazonArticleFromBulk(keyWord, internalUrl, tone, pointOfView, includeFAQs, currentUser, finetuneChosen, wordRange, citeSources, itemId, isAmazonArticle, amazonUrl, affiliate, numberOfProducts)
        } else {
            const article = await processBlogArticleFromBulk(keyWord, internalUrl, tone, pointOfView, includeFAQs, currentUser, finetuneChosen)
        }

        await firebaseFunctions.markItemCompleted(itemId)
    } catch (e) {
        console.log('Error processing bulk Article: ', e)
        await firebaseFunctions.markItemInError(itemIdProcess)
        throw new Error(e)
    }
}

module.exports = {
    processNextItem
};