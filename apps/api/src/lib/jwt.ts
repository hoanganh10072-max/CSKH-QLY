import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";

export type JwtUserPayload = {
  sub: string;
  role: UserRole;
};

const signOptions: SignOptions = {
  expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  issuer: "cskh-crm"
};

export const signAccessToken = (payload: JwtUserPayload) =>
  jwt.sign(payload, env.JWT_SECRET, signOptions);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET, { issuer: "cskh-crm" }) as JwtUserPayload;
