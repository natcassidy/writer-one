const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
    res.status(200).send("I'm alive")
})

module.exports = router;

