import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import * as tagsService from '../services/tags.service.js';

export const searchTags = asyncHandler(async (req, res) => {
  ok(res, await tagsService.searchTags(req.query.search));
});
