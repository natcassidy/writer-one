const admin = require('firebase-admin');

const updateFirebaseJob = async (currentUser, jobId, fieldName, data, articleType) => {
    if (!currentUser) {
        throw new Error('No user defined');
    }
    const jobsCollection = admin.firestore().collection("jobs");
    const cleanedData = cleanData(data);

    try {
        if (jobId === -1) {
            const newJobData = {
                [fieldName]: cleanedData,
                lastModified: Date.now(),
                type: articleType
            };
            const newDocRef = await jobsCollection.add(newJobData);

            console.log("New job created with ID:", newDocRef.id);
            await addJobIdToUserFirebase(currentUser, newDocRef.id);

            return newDocRef.id;
        } else {
            const jobRef = jobsCollection.doc(jobId.toString());

            // Define the data to update including the last modified timestamp
            const updateData = {
                [fieldName]: cleanedData,
                lastModified: Date.now() // Add last modified timestamp
            };

            // Fetch the current document to check if it exists and get the current context
            const doc = await jobRef.get();
            if (fieldName === "context" && doc.exists && doc.data().context) {
                // If the document and context field exist, concatenate the new data
                const updatedContext = doc.data().context + cleanedData;
                updateData[fieldName] = updatedContext;
            }
            // Perform the update or set operation with last modified timestamp
            if (doc.exists) {
                await jobRef.update(updateData);
            } else {
                await jobRef.set(updateData, { merge: true });
            }

            console.log("Job updated successfully");
            await addJobIdToUserFirebase(currentUser, jobId);

            return jobId;
        }
    } catch (error) {
        console.error("Error updating job:", error);
        throw error;
    }
};

function cleanData(data) {
    if (data === null || data === undefined) return null; // Or some default value
    if (typeof data !== 'object') return data;
    for (const key of Object.keys(data)) {
        data[key] = cleanData(data[key]);
    }
    return data;
}

const getContextFromDb = async (currentUser, jobId) => {
    if (!currentUser) {
        throw new Error('No user defined');
    }

    const jobsCollection = admin.firestore().collection("jobs");

    let context = ""

    try {
        const jobRef = jobsCollection.doc(jobId.toString());
        // Fetch the current document to check if it exists and get the current context
        const doc = await jobRef.get();
        if (doc.exists && doc.data().context) {
            // If the document and context field exist, concatenate the new data
            context = doc.data().context
        }

        console.log("Context retrieved successfully");

        return context;
    } catch (error) {
        console.error("Error finding data:", error);
        throw error; // Re-throw the error to handle it outside this function if needed
    }
};

const addJobIdToUserFirebase = async (currentUser, jobId) => {
    if (!currentUser) {
        throw new Error('No user defined')
    }

    const userRef = admin.firestore().collection("customers").doc(currentUser.uid);

    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("No such document!");
            return;
        }

        // Assuming 'jobs' is an array of job objects.
        const userData = doc.data();
        let jobs = userData.jobs || [];

        // Find the index of the job you want to update.
        const jobIndex = jobs.findIndex(job => job === jobId);
        if (jobIndex === -1) {
            jobs.push(jobId)
            await userRef.update({ jobs: jobs });
        } else {
            console.log('Job already exists on user object')
        }

    } catch (error) {
        console.error("Error updating job:", error);
        throw error; // Re-throw the error to handle it outside this function if needed
    }
}

const addFinetunetoFirebaseUser = async (currentUser, urls, title, content) => {
    if (!currentUser) {
        throw new Error('No user defined')
    }

    let newFinetune = {
        name: title, 
        urls: urls,
        content: content
    }

    const userRef = admin.firestore().collection("customers").doc(currentUser.uid);

    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("No such document!");
            return;
        }

        // Assuming 'jobs' is an array of job objects.
        const userData = doc.data();
        let finetunes = userData.finetunes || [];

        // Find the index of the job you want to update.
        const finetuneIndex = finetunes.findIndex(finetune => finetune.title === title);
        if (finetuneIndex === -1) {
            finetunes.push(newFinetune)
            await userRef.update({ finetunes: finetunes });
        } else {
            console.log('Finetune already exists on user object')
        }

    } catch (error) {
        console.error("Error updating finetunes:", error);
        throw error; // Re-throw the error to handle it outside this function if needed
    }
}

const findFinetuneInFirebase = async (currentUser, urls, name) => {
    if (!currentUser) {
        throw new Error('No user defined');
    }

    const userRef = admin.firestore().collection("customers").doc(currentUser.uid);

    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("No such document!");
            return null; // Explicitly return null to indicate no document was found
        }

        const userData = doc.data();
        let finetunes = userData.finetunes || [];

        // Find a finetune that matches both title and urls
        const matchingFinetune = finetunes.find(finetune => {
            return finetune.name === name && arraysMatch(finetune.urls, urls);
        });

        // If a matching finetune is found, return its content
        if (matchingFinetune) {
            return matchingFinetune.content;
        } else {
            console.log("No matching finetune found.");
            return null; // Explicitly return null to indicate no matching finetune was found
        }
    } catch (error) {
        console.error("Error finding finetune:", error);
        throw error; // Re-throw the error to handle it outside this function if needed
    }
};

// Helper function to check if two arrays contain the same elements in any order
const arraysMatch = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    const sortedArr1 = arr1.slice().sort();
    const sortedArr2 = arr2.slice().sort();
    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i]) {
            return false;
        }
    }
    return true;
};

const decrementUserWordCount = async (currentUser, amountToDecrement) => {
    if (!currentUser) {
        throw new Error('No user defined');
    }

    const userRef = admin.firestore().collection("customers").doc(currentUser.uid);

    let newWordCount = 0;
    try {
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("No such document!");
            return;
        }

        // Correctly retrieve and decrement the word count
        const currentWordCount = doc.data().words;
        newWordCount = currentWordCount - amountToDecrement;

        // Check for negative values
        if (newWordCount < 0) {
            console.log("Word count cannot be negative.");
            newWordCount = 0;
        }

        // Update the document with the new word count
        await userRef.update({ words: newWordCount });
    } catch (error) {
        console.error("Error updating word count:", error);
        throw error; // Rethrowing the error is a good practice for error handling
    }

    return newWordCount;
};


module.exports = {
    updateFirebaseJob,
    getContextFromDb,
    decrementUserWordCount,
    addFinetunetoFirebaseUser,
    findFinetuneInFirebase
};