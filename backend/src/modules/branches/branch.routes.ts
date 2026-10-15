import { Router, type Request, type Response } from "express";
import { ok, requireUser } from "../../lib/http.js";
import { adminOnly, optionalAuth } from "../../middleware/auth.js";
import {
  AssignRiderBody,
  BranchByDistanceQuery,
  BranchIdParam,
  CreateBranchBody,
  NearestBranchQuery,
  RiderIdParam,
  SetOnlineBody,
  UpdateBranchBody,
} from "./branch.schema.js";
import * as service from "./branch.service.js";
import { presentBranch, presentBranchWithDistance } from "./branch.presenter.js";

// ─── Public router (/api/v1/branches) ─────────────────────────────────────

export const branchesRouter = Router();
branchesRouter.use(optionalAuth);

// NOTE: /nearest must come before /:id so the literal segment matches first.
branchesRouter.get("/nearest", async (req: Request, res: Response) => {
  const { lat, lng } = NearestBranchQuery.parse(req.query);
  const branch = await service.findNearestBranch(lat, lng);
  res.json(ok(presentBranchWithDistance(branch)));
});

branchesRouter.get("/", async (req: Request, res: Response) => {
  const { lat, lng, limit } = BranchByDistanceQuery.parse(req.query);
  const branches = await service.listBranchesByDistance(lat, lng, limit);
  res.json(ok(branches.map(presentBranchWithDistance)));
});

branchesRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = BranchIdParam.parse(req.params);
  const branch = await service.getBranchById(id);
  res.json(ok(presentBranch(branch)));
});

// ─── Admin router (/api/v1/admin/branches) ────────────────────────────────

export const adminBranchesRouter = Router();
adminBranchesRouter.use(adminOnly);

adminBranchesRouter.get("/", async (_req: Request, res: Response) => {
  res.json(ok(await service.listBranchesAdmin()));
});

adminBranchesRouter.post("/", async (req: Request, res: Response) => {
  const branch = await service.createBranch(CreateBranchBody.parse(req.body));
  res.status(201).json(ok(branch));
});

adminBranchesRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = BranchIdParam.parse(req.params);
  res.json(ok(presentBranch(await service.getBranchById(id))));
});

adminBranchesRouter.patch("/:id", async (req: Request, res: Response) => {
  const { id } = BranchIdParam.parse(req.params);
  res.json(ok(await service.updateBranch(id, UpdateBranchBody.parse(req.body))));
});

adminBranchesRouter.delete("/:id", async (req: Request, res: Response) => {
  const { id } = BranchIdParam.parse(req.params);
  await service.deleteBranch(id);
  res.status(204).end();
});

adminBranchesRouter.patch("/:id/online", async (req: Request, res: Response) => {
  const { id } = BranchIdParam.parse(req.params);
  const { isOnline, reason } = SetOnlineBody.parse(req.body);
  const actorId = requireUser(req).userId;
  res.json(ok(presentBranch(await service.setBranchOnlineStatus(id, isOnline, reason, actorId))));
});

// Rider assignment
adminBranchesRouter.get("/:id/riders", async (req: Request, res: Response) => {
  const { id } = BranchIdParam.parse(req.params);
  res.json(ok(await service.getBranchRiders(id)));
});

adminBranchesRouter.post("/:id/riders", async (req: Request, res: Response) => {
  const { id } = BranchIdParam.parse(req.params);
  const { riderId } = AssignRiderBody.parse(req.body);
  res.status(201).json(ok(await service.assignRiderToBranch(id, riderId)));
});

adminBranchesRouter.delete("/:id/riders/:riderId", async (req: Request, res: Response) => {
  const { id } = BranchIdParam.parse(req.params);
  const { riderId } = RiderIdParam.parse(req.params);
  await service.unassignRiderFromBranch(id, riderId);
  res.status(204).end();
});
