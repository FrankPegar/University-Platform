import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import * as departmentsService from '../services/departments.service.js';

export const listDepartments = asyncHandler(async (req, res) => {
  ok(res, await departmentsService.listDepartments());
});

export const listCourses = asyncHandler(async (req, res) => {
  ok(res, await departmentsService.listCoursesByDepartment(req.params.id));
});
