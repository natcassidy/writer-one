const admin = require("firebase-admin");

const updateFirebaseJob = async (
  currentUser,
  jobId,
  fieldName,
  data,
  articleType
) => {
  if (!currentUser) {
    throw new Error("No user defined");
  }
  const jobsCollection = admin.firestore().collection("jobs");
  const cleanedData = cleanData(data);

  try {
    if (jobId === -1) {
      const newJobData = {
        [fieldName]: cleanedData,
        lastModified: Date.now(),
        type: articleType,
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
        lastModified: Date.now(), // Add last modified timestamp
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

const updateFirebaseJobByIp = async (
  ipAddress,
  jobId,
  fieldName,
  data,
  articleType
) => {
  if (!ipAddress) {
    throw new Error("No ipAddress defined");
  }
  const jobsCollection = admin.firestore().collection("jobs");
  const cleanedData = cleanData(data);

  try {
    if (jobId === -1) {
      const newJobData = {
        [fieldName]: cleanedData,
        lastModified: Date.now(),
        type: articleType,
      };
      const newDocRef = await jobsCollection.add(newJobData);

      console.log("New job created with ID:", newDocRef.id);
      await addJobIdToIpFirebase(ipAddress, newDocRef.id);

      return newDocRef.id;
    } else {
      const jobRef = jobsCollection.doc(jobId.toString());

      // Define the data to update including the last modified timestamp
      const updateData = {
        [fieldName]: cleanedData,
        lastModified: Date.now(), // Add last modified timestamp
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
      await addJobIdToIpFirebase(ipAddress, jobId);

      return jobId;
    }
  } catch (error) {
    console.error("Error updating job:", error);
    throw error;
  }
};

function cleanData(data) {
  if (data === null || data === undefined) return null; // Or some default value
  if (typeof data !== "object") return data;
  for (const key of Object.keys(data)) {
    data[key] = cleanData(data[key]);
  }
  return data;
}

const getContextFromDb = async (currentUser, jobId) => {
  if (!currentUser) {
    throw new Error("No user defined");
  }

  const jobsCollection = admin.firestore().collection("jobs");

  let context = "";

  try {
    const jobRef = jobsCollection.doc(jobId.toString());
    // Fetch the current document to check if it exists and get the current context
    const doc = await jobRef.get();
    if (doc.exists && doc.data().context) {
      // If the document and context field exist, concatenate the new data
      context = doc.data().context;
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
    throw new Error("No user defined");
  }

  const userRef = admin
    .firestore()
    .collection("customers")
    .doc(currentUser.uid);

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
    const jobIndex = jobs.findIndex((job) => job === jobId);
    if (jobIndex === -1) {
      jobs.push(jobId);
      await userRef.update({ jobs: jobs });
    } else {
      console.log("Job already exists on user object");
    }
  } catch (error) {
    console.error("Error updating job:", error);
    throw error; // Re-throw the error to handle it outside this function if needed
  }
};

const addJobIdToIpFirebase = async (ipAddress, jobId) => {
  if (!ipAddress) {
    throw new Error("No ipAddress defined");
  }

  const ipTrialRef = admin.firestore().collection("ipTrial").doc(ipAddress);

  try {
    await ipTrialRef.update({
      jobId: jobId,
    });
  } catch (error) {
    console.error("Error updating job:", error);
    throw error; // Re-throw the error to handle it outside this function if needed
  }
};

const addFinetunetoFirebaseUser = async (
  currentUser,
  urls,
  name,
  textInputs
) => {
  if (!currentUser) {
    throw new Error("No user defined");
  }

  let newFinetune = {
    name: name,
    urls: urls,
    textInputs: textInputs,
  };

  const userRef = admin
    .firestore()
    .collection("customers")
    .doc(currentUser.uid);

  try {
    const doc = await userRef.get();

    if (!doc.exists) {
      console.log("No such document!");
      return;
    }

    const userData = doc.data();
    let finetunes = userData.finetunes || [];

    const finetuneIndex = finetunes.findIndex(
      (finetune) => finetune.name === name
    );
    if (finetuneIndex === -1) {
      // If the finetune does not exist, push the new one
      finetunes.push(newFinetune);
    } else {
      // Replace the existing finetune with the new one
      finetunes[finetuneIndex] = newFinetune;
    }
    // Update the document with the new list of finetunes
    await userRef.update({ finetunes: finetunes });
  } catch (error) {
    console.error("Error updating finetunes:", error);
    throw error; // Re-throw the error to handle it outside this function if needed
  }
};

const findFinetuneInFirebase = async (currentUser, urls, name) => {
  if (!currentUser) {
    throw new Error("No user defined");
  }

  const userRef = admin
    .firestore()
    .collection("customers")
    .doc(currentUser.uid);

  try {
    const doc = await userRef.get();

    if (!doc.exists) {
      console.log("No such document!");
      return null; // Explicitly return null to indicate no document was found
    }

    const userData = doc.data();
    let finetunes = userData.finetunes || [];

    // Find a finetune that matches both title and urls
    const matchingFinetune = finetunes.find((finetune) => {
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

const decrementUserArticleCount = async (currentUser) => {
  if (!currentUser) {
    throw new Error("No user defined");
  }

  const userRef = admin
    .firestore()
    .collection("customers")
    .doc(currentUser.uid);

  try {
    const doc = await userRef.get();

    if (!doc.exists) {
      console.log("No such document!");
      return;
    }

    // Correctly retrieve and decrement the word count
    const currentArticles = doc.data().articles;
    let newArticleCount = currentArticles - 1;

    // Check for negative values
    if (newArticleCount < 0) {
      console.log("Word count cannot be negative.");
      newArticleCount = 0;
    }

    // Update the document with the new word count
    await userRef.update({ articles: newArticleCount });
  } catch (error) {
    console.error("Error updating word count:", error);
    throw error; // Rethrowing the error is a good practice for error handling
  }

  return newArticleCount;
};

const addToQueue = async (
  keyWord,
  internalUrls,
  tone,
  pointOfView,
  includeFAQs,
  currentUser,
  finetuneChosen,
  sectionCount,
  citeSources,
  isAmazonArticle,
  amazonUrl,
  affiliate,
  numberOfProducts
) => {
  await admin.firestore().collection("queue").add({
    keyWord,
    internalUrls,
    tone,
    pointOfView,
    includeFAQs,
    currentUser,
    finetuneChosen,
    status: "pending",
    sectionCount,
    citeSources,
    isAmazonArticle,
    amazonUrl,
    affiliate,
    numberOfProducts,
    createdAt: Date.now(),
  });
};

const getNextItemFirebase = async () => {
  // Check the count of items with status "inProgress"
  const inProgressSnapshot = await admin
    .firestore()
    .collection("queue")
    .where("status", "==", "inProgress")
    .get();

  if (inProgressSnapshot.size >= 2) {
    throw new Error("Maximum limit of inProgress items reached");
  }

  const snapshot = await admin
    .firestore()
    .collection("queue")
    .where("status", "==", "pending")
    .orderBy("createdAt")
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const item = snapshot.docs[0];
    const itemId = item.id;
    return { itemId, ...item.data() };
  } else {
    throw new Error("No pending items in the queue");
  }
};

const markItemCompleted = async (itemId) => {
  try {
    // Update the item status to 'completed'
    await admin.firestore().collection("queue").doc(itemId).update({
      status: "completed",
    });

    console.log(`Item ${itemId} processed successfully`);
  } catch (e) {
    throw new Error(e);
  }
};

const markItemInProgress = async (itemId) => {
  try {
    // Update the item status to 'completed'
    await admin.firestore().collection("queue").doc(itemId).update({
      status: "inProgress",
    });

    console.log(`Item ${itemId} in progress`);
  } catch (e) {
    throw new Error(e);
  }
};

const markItemInError = async (itemId) => {
  try {
    // Update the item status to 'completed'
    await admin.firestore().collection("queue").doc(itemId).update({
      status: "inError",
    });

    console.log(`Item ${itemId} in error`);
  } catch (e) {
    throw new Error(e);
  }
};

async function validateIpHasFreeArticle(ipAddress) {
  try {
    const ipTrialRef = admin.firestore().collection("ipTrial").doc(ipAddress);
    const ipTrialDoc = await ipTrialRef.get();

    if (ipTrialDoc.exists) {
      const { docsCreated } = ipTrialDoc.data();
      return docsCreated === 0;
    } else {
      await createIpTrialDoc(ipAddress);
      return true;
    }
  } catch (error) {
    console.error("Error validating IP for free article:", error);
    throw error;
  }
}

async function createIpTrialDoc(ipAddress) {
  try {
    const ipTrialRef = admin.firestore().collection("ipTrial").doc(ipAddress);
    await ipTrialRef.set({
      ip: ipAddress,
      docsCreated: 0,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error("Error creating IP trial document:", error);
    throw error;
  }
}

async function updateIpFreeArticle(ipAddress) {
  try {
    const ipTrialRef = admin.firestore().collection("ipTrial").doc(ipAddress);
    await ipTrialRef.update({
      docsCreated: 1,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Error updating IP free article count:", error);
    throw error;
  }
}

module.exports = {
  updateFirebaseJob,
  getContextFromDb,
  decrementUserArticleCount,
  addFinetunetoFirebaseUser,
  findFinetuneInFirebase,
  addToQueue,
  getNextItemFirebase,
  markItemCompleted,
  markItemInProgress,
  markItemInError,
  validateIpHasFreeArticle,
  updateIpFreeArticle,
  updateFirebaseJobByIp,
};
