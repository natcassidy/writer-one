const admin = require('firebase-admin');
require('dotenv').config();
admin.initializeApp({
    credential: admin.credential.cert(process.env.FB_CREDENTIAL_PATH),
});
module.exports = admin;
//# sourceMappingURL=firebase.js.map