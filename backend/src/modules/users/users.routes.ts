import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { idParam, ok, requireUser } from "../../lib/http.js";
import { adminOnly, authenticate } from "../../middleware/auth.js";
import { adminAdjustCoins } from "../coins/coins.service.js";
import { applyReferralCodeForUser, getReferralSummary } from "../referrals/referrals.service.js";
import { coinAdjustSchema, customerListQuery, profileUpdateSchema } from "./users.schema.js";
import * as service from "./users.service.js";

const applyReferralSchema = z.object({
  referralCode: z.string().trim().min(1, "Enter a referral code"),
});

export const profileRouter = Router();
profileRouter.use(authenticate);

profileRouter.patch("/", async (req: Request, res: Response) => {
  res.json(ok(await service.updateProfile(requireUser(req).userId, profileUpdateSchema.parse(req.body))));
});

profileRouter.get("/referrals", async (req: Request, res: Response) => {
  res.json(ok(await getReferralSummary(requireUser(req).userId)));
});

profileRouter.post("/referrals", async (req: Request, res: Response) => {
  const { referralCode } = applyReferralSchema.parse(req.body);
  res.json(ok(await applyReferralCodeForUser(requireUser(req).userId, referralCode)));
});

export const adminCustomersRouter = Router();
adminCustomersRouter.use(adminOnly);

adminCustomersRouter.get("/", async (req: Request, res: Response) => {
  const { items, meta } = await service.listCustomers(customerListQuery.parse(req.query));
  res.json(ok(items, meta));
});

adminCustomersRouter.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  res.json(ok(await service.getCustomer(id)));
});

adminCustomersRouter.patch("/:id/block", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { isBlocked } = z.object({ isBlocked: z.boolean() }).parse(req.body);
  res.json(ok(await service.setBlocked(id, isBlocked)));
});

adminCustomersRouter.post("/:id/coins", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { amount, note } = coinAdjustSchema.parse(req.body);
  res.json(ok(await adminAdjustCoins(id, amount, note)));
});
