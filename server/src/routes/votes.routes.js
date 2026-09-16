import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { voteSchema, voteStateSchema } from '../validators/vote.validators.js';
import * as votesController from '../controllers/votes.controller.js';

const router = Router();

router.use(requireAuth); // Q&A content is authenticated-only per RLS policy

router.get('/', validate(voteStateSchema), votesController.getVoteState);
router.post('/', validate(voteSchema), votesController.addVote);
router.delete('/', validate(voteSchema), votesController.removeVote);

export default router;
