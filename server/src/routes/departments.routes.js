import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { departmentIdParamSchema } from '../validators/departments.validators.js';
import * as departmentsController from '../controllers/departments.controller.js';

const router = Router();

// No requireAuth here: departments/courses must be readable before a
// student has an account, to populate the Register page dropdowns. This
// matches the public-read RLS policy on these two tables.
router.get('/', departmentsController.listDepartments);
router.get('/:id/courses', validate(departmentIdParamSchema), departmentsController.listCourses);

export default router;
