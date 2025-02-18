import admin from "firebase-admin";

const updateFirebaseJob = async (
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

export { updateFirebaseJob };