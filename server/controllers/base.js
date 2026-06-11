/**
 * Base controller factory that wraps a CrudService with asyncHandler
 * for clean Express route handlers.
 */
const { asyncHandler } = require('../middleware/errorHandler');

function createController(service) {
  return {
    getAll: asyncHandler(async (req, res) => {
      const items = await service.getAll();
      res.json(items);
    }),

    create: asyncHandler(async (req, res) => {
      const item = await service.create(req.body);
      res.status(201).json(item);
    }),

    update: asyncHandler(async (req, res) => {
      const item = await service.update(req.params.id, req.body);
      res.json(item);
    }),

    remove: asyncHandler(async (req, res) => {
      await service.remove(req.params.id);
      res.json({ message: 'Deleted' });
    }),
  };
}

module.exports = { createController };
