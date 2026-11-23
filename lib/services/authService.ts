import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Types } from 'mongoose';
import UserLoginLog from 'lib/models/spatie/UserLoginLog';
import UserSession from 'lib/models/spatie/UserSession';
import User from 'lib/models/spatie/User';
import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import { logError } from './errorService';
import { PipelineStage } from "mongoose";
import Menu from 'lib/models/spatie/Menu';
import UserPermission from 'lib/models/spatie/UserPermission';
import Otp, { IOtp } from 'lib/models/spatie/Otp';

export function getClientIP(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
}

export async function getGeoLocationFromIP(ip: string) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Localhost', region: 'Local', city: 'Local' };
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
    const data = await response.json();

    if (data.status === 'success') {
      return {
        country: data.country,
        region: data.regionName,
        city: data.city,
      };
    }
  } catch (error) { await logError(error, { function: "getGeoLocationFromIP", payload: {ip} }); }
  return { country: 'Unknown', region: 'Unknown', city: 'Unknown' };
}

export function generateJWTToken(user: any, roles: { _id: string; name: string }[], permissions: { _id: string; name: string }[]): string {
  if (!process.env.JWT_SECRET) { throw new Error("JWT_SECRET is not defined in environment variables"); }

  const payload = {
    _id: user._id.toString(),
    name: user.name ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    roles,
    permissions,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export async function recordUserLogin(req: any, user_id: Types.ObjectId) {
  try {
    const ip_address = getClientIP(req);
    const device = req.headers['user-agent'] || 'Unknown Device';
    const location = req.body.location || await getGeoLocationFromIP(ip_address);
    const browser = req.body.browser || device;
    const os = req.body.os || 'Unknown OS';
  
    await UserLoginLog.create({
      user_id,
      device,
      ip_address,
      ...location,
      browser,
      os,
      login_at: new Date(),
    });
  } catch (error) { 
    await logError(error, { function: "recordUserLogin", payload: req.body }); 
  }
}

export async function createUserSession(req: any, user_id: Types.ObjectId, token: string) {
  try {
    const ip_address = getClientIP(req);
    const device = req.headers['user-agent'] || 'Unknown Device';
    const location = await getGeoLocationFromIP(ip_address);

    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
    
    await UserSession.deleteMany({ user_id });

    await UserSession.create({
      user_id,
      token_hash,
      device,
      ip_address,
      ...location,
      last_activity: new Date(),
      expires_at,
    });

    cleanupOldLoginLogs();
  } catch (error) { await logError(error, { function: "createUserSession", payload: req.body }); }
}

export async function generateAuthLoad(req: any, user_id: string | Types.ObjectId): Promise<string | null> {
  try {
    const user = await User.findOne({ _id: user_id, status: true })
    .populate([
      { path: "rolesAttached", populate: { path: "role_id", model: "SpatieRole", select: "_id name" } },
      { path: "permissionsAttached", populate: { path: "permission_id", model: "SpatiePermission", select: "_id name" } }
    ]).lean<any>().exec();
  
    if (!user) return null;
    
    const roles = user.rolesAttached?.map((r: any) => ({ _id: r.role_id._id.toString(), name: r.role_id.name })) || [];
    const permissions = user.permissionsAttached?.map((p: any) => ({ _id: p.permission_id._id.toString(), name: p.permission_id.name })) || [];
    const token = generateJWTToken(user, roles, permissions);

    await Promise.all([
      createUserSession(req, user._id, token),
      recordUserLogin(req, user._id)
    ]);

    return token;
  } catch (error) { await logError(error, { function: "createUserSession", payload: req.body }); return null; } 
}

export async function getUserIdFromToken(req: NextApiRequest): Promise<string | null> {
  try {
    let token: string | null = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token && req.headers.cookie) {
      const cookies = parse(req.headers.cookie);
      if (cookies.authToken && cookies.authToken !== "undefined") {
        token = cookies.authToken;
      }
    }
    if (!token) { return null; }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (!decoded?._id) return null;

    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const activeSession = await UserSession.findOne({ token_hash, user_id: decoded._id });

    if (!activeSession) {
      const user = await User.findOne({ _id: decoded._id, status: true }).select('_id');
      if (!user) return null;

      await Promise.all([
        createUserSession(req, user._id, token),
        recordUserLogin(req, user._id)
      ]);
    }

    return decoded._id;
  } catch (error) { await logError(error, { function: "getUserIdFromToken", payload: req.body }); return null; }
}

export async function authMiddleware(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  try {
    const user_id = await getUserIdFromToken(req);
    (req as any).user_id = user_id || null;
  } catch (error) { (req as any).user_id = null; }

  next();
}

export async function cleanupOldLoginLogs(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await UserLoginLog.deleteMany({
      login_at: { $lt: thirtyDaysAgo }
    });

    return result.deletedCount || 0;
  } catch (error) { return 0; }
}

export async function logOut(req: any): Promise<boolean> {
  try {
    let token: string | null = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.headers.cookie) {
      const cookies = parse(req.headers.cookie);
      if (cookies.authToken && cookies.authToken !== "undefined") {
        token = cookies.authToken;
      }
    }

    if (token) {
      const token_hash = crypto.createHash('sha256').update(token).digest('hex');
      await UserSession.deleteOne({ token_hash });
    }
    
    return true;
  } catch (error) { await logError(error, { function: "logOut", payload: req.body }); return false; }
}

export async function getUsersWithRole(roleNames: string[]) {
  try {
    const pipeline: PipelineStage[] = [
      { $lookup: { from: "userroles", localField: "_id", foreignField: "user_id", as: "rolesAttached" } },
      { $lookup: { from: "spatieroles", localField: "rolesAttached.role_id", foreignField: "_id", as: "roles" } },
      { $lookup: { from: "userpermissions", localField: "_id", foreignField: "user_id", as: "permissionsAttached" } },
      { $lookup: { from: "spatiepermissions", localField: "permissionsAttached.permission_id", foreignField: "_id", as: "permissions" } },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          phone: 1,
          status: 1,
          createdAt: 1,
          roles: { _id: 1, name: 1, status: 1 },
          permissions: { _id: 1, name: 1 },
        },
      },
    ];
  
    if (roleNames && roleNames.length > 0) {
      const regexRoles = roleNames.map(r => new RegExp(`^${r}$`, 'i'));
      pipeline.push({ $match: { "roles.name": { $in: regexRoles } } });
    }
  
    return await User.aggregate(pipeline).exec();
  } catch (error) { return await logError(error, { function: "getUsersWithRole", payload: { roleNames } }); }
}

export async function getUserModule(roleName?: string) {
  try {
    const pipeline: PipelineStage[] = [
      { $lookup: { from: "userroles", localField: "_id", foreignField: "user_id", as: "rolesAttached", } },
      { $lookup: { from: "spatieroles", localField: "rolesAttached.role_id", foreignField: "_id", as: "roles", } },
    ];

    if (roleName) {
      pipeline.push({ $match: { "roles.name": roleName } });
    }

    pipeline.push({ $project: { _id: 1, name: 1 } });

    return await User.aggregate(pipeline).exec();
  } catch (error) { return await logError(error, { function: "getUserModule", payload: {roleName} }); }
}

export async function checkPermissionLogic(req: NextApiRequest, url?: string) {
  try {
    const user_id = await getUserIdFromToken(req);
    if (!user_id) return { message: 'Checked Permissions - Auth Missing', data: false };

    const finalUrl = url || (req.query.url as string);
    if (!finalUrl) return { message: 'Checked Permissions - URL Missing', data: false };

    if (finalUrl.includes('/user/')) {
      return { message: 'Auto-allowed because of /user/', data: true };
    }

    const menu = await Menu.findOne({ url: finalUrl, status: true });
    if (!menu) return { message: 'Checked Permissions - Menu Missing', data: false };
    
    const hasPermission = await UserPermission.findOne({
      user_id: user_id,
      permission_id: menu.permission_id,
    });
    
    if (!hasPermission) { return { message: 'Permission Denied', data: false }; }

    return { message: 'Permission To Enter', data: true };
  } catch (error) { await logError(error, { function: "checkPermissionLogic", payload: req.body }); }
}

interface OtpPayload {
  type: string;
  email?: string;
  phone?: string;
  ttlMinutes?: number;
  req: NextApiRequest;
}

export async function createOtp({ type, email, phone, ttlMinutes = 5, req }: OtpPayload): Promise<IOtp> {
  const user_id = await getUserIdFromToken(req);
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const deleteConditions: Record<string, any> = {};
  if (email) deleteConditions.email = email;
  if (phone) deleteConditions.phone = phone;
  if (user_id) deleteConditions.user_id = user_id;

  await Otp.deleteMany(deleteConditions);

  const entry = await Otp.create({
    type,
    email,
    phone,
    otp,
    expiresAt,
    ...(await user_id && { user_id }),
  });

  return entry;
}