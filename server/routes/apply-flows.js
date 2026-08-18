const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { listApplyFlows } = require('../services/applyFlow');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const flows = await listApplyFlows();
  res.json(flows);
}));

module.exports = router;
