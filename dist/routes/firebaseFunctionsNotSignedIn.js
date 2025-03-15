"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFirebaseJobByIp = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const updateFirebaseJobByIp = async (ipAddress, jobId, fieldName, data, articleType) => {
    if (!ipAddress) {
        throw new Error("No ipAddress defined");
    }
    const jobsCollection = firebase_admin_1.default.firestore().collection("jobs");
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
        }
        else {
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
            }
            else {
                await jobRef.set(updateData, { merge: true });
            }
            console.log("Job updated successfully");
            await addJobIdToIpFirebase(ipAddress, jobId);
            return jobId;
        }
    }
    catch (error) {
        console.error("Error updating job:", error);
        throw error;
    }
};
exports.updateFirebaseJobByIp = updateFirebaseJobByIp;
function cleanData(data) {
    if (data === null || data === undefined)
        return null; // Or some default value
    if (typeof data !== "object")
        return data;
    for (const key of Object.keys(data)) {
        data[key] = cleanData(data[key]);
    }
    return data;
}
const addJobIdToIpFirebase = async (ipAddress, jobId) => {
    if (!ipAddress) {
        throw new Error("No ipAddress defined");
    }
    const ipTrialRef = firebase_admin_1.default.firestore().collection("ipTrial").doc(ipAddress);
    try {
        await ipTrialRef.update({
            jobId: jobId,
        });
    }
    catch (error) {
        console.error("Error updating job:", error);
        throw error; // Re-throw the error to handle it outside this function if needed
    }
};
//# sourceMappingURL=firebaseFunctionsNotSignedIn.js.map