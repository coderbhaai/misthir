import path from 'path';
import fs from "fs";
import sharp from 'sharp';
import Media from 'lib/models/basic/Media';
import { v4 as uuidv4 } from 'uuid';
import mongoose, { isValidObjectId, Types } from 'mongoose';
import MediaHub, { MediaHubProps } from 'lib/models/basic/MediaHub';
import type { File as FormidableFile } from "formidable";
import { AnyModel } from 'lib/models';
import { sanitizeText } from './dataService';
import { logError } from './errorService';

export const MEDIA_PATH = path.join(process.cwd(), 'public', 'storage');

export const getUniqueFilename = (uploadDir: string, name: string, fileName: string, fileExt: string): string => {
  const sanitName = sanitizeText(name);
  let finalName = `${sanitName}${fileExt}`;
  const filePath = path.join(uploadDir, finalName);

  if (fs.existsSync(filePath)) {
    const uniqueId = uuidv4();
    finalName = `${sanitName}-${uniqueId}${fileExt}`;
  }
  return finalName;
};

interface SyncMediaHubOptions {
  module: string;
  module_id: string | Types.ObjectId;
  mediaArray: string[];
}

export async function syncMediaHub({ module, module_id, mediaArray }: SyncMediaHubOptions) {
  if (!Array.isArray(mediaArray)) { throw new Error("mediaArray must be an array"); }

  for (const [index, i] of mediaArray.entries()) {
    await MediaHub.findOneAndUpdate({ module, module_id, media_id: i },
      { $setOnInsert: { primary: index === 0, status: true, displayOrder: index, }, },
      { upsert: true, new: true }
    );
  }

  await MediaHub.deleteMany({ module, module_id, media_id: { $nin: mediaArray } });
}

export async function uploadFileLocal( file: FormidableFile, folder: string, oldFilePath?: string ) {
  const uploadDir = path.join(process.cwd(), "private", folder);

  await new Promise<void>((resolve, reject) => {
    fs.mkdir(uploadDir, { recursive: true }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  if (oldFilePath) {
    const oldPath = path.isAbsolute(oldFilePath) ? oldFilePath : path.join(uploadDir, oldFilePath);

    fs.access(oldPath, fs.constants.F_OK, (err) => {
      if (!err) {
        fs.unlink(oldPath, (unlinkErr) => {
          if (unlinkErr) console.error("❌ Failed to delete old file:", unlinkErr);
        });
      }
    });
  }

  const ext = path.extname(file.originalFilename || "");
  const filename = `${uuidv4()}${ext}`;
  const newPath = path.join(uploadDir, filename);

  await new Promise<void>((resolve, reject) => {
    fs.copyFile(file.filepath, newPath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  return { path: newPath, filename, mimetype: file.mimetype, size: file.size };
}

export const getPaths = (type: string) => {
  const paths = {
    blog: { folder: 'blog', small: [150, 150], thumbnail: [300, 200] },
    author: { folder: 'author', small: [100, 100], thumbnail: [200, 150] },
    banner: { folder: 'banner', small: [1920, 500], thumbnail: [1920, 500] },
    blocks: { folder: 'blocks', small: [], thumbnail: [] },
    page: { folder: 'page', small: [], thumbnail: [] },
    accredition: { folder: 'medical/accredition', small: [], thumbnail: [] },
    treatment: { folder: 'medical/treatment', small: [], thumbnail: [] },
    treatmentType: { folder: 'medical/treatment-type', small: [], thumbnail: [] },
    doctor: { folder: 'medical/doctor', small: [], thumbnail: [] },
    hospital: { folder: 'medical/hospital', small: [], thumbnail: [] },
    package: { folder: 'medical/package', small: [], thumbnail: [] },
    product_brand: { folder: 'product/brand', small: [], thumbnail: [] },
    product_type: { folder: 'product/type', small: [], thumbnail: [] },
    uploads: { folder: 'uploads', small: [], thumbnail: [] },
  };
  return paths[type as keyof typeof paths] ?? paths.uploads;
};

const ensureDirs = (basePath: string, small: number[], thumbnail: number[]) => {
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
  if (small.length) fs.mkdirSync(path.join(basePath, 'small'), { recursive: true });
  if (thumbnail.length) fs.mkdirSync(path.join(basePath, 'thumbnail'), { recursive: true });
};

const resizeImage = async (inputPath: string, outputPath: string, size: number[]) => {
  await sharp(inputPath).resize(...size).toFile(outputPath);
};

interface UploadMediaParams {
  file: any;
  name: string;
  alt?: string;
  pathType: string;
  media_id?: string | null;
  user_id?: string | null;
}

export const deleteOldImage = async ( mediaModel: AnyModel, media_id: string | mongoose.Types.ObjectId ) => {
  if (!media_id) return;

  try {
    const media = await mediaModel.findById(media_id);
    if (!media) return;

    // ============ 🧩 CASE 1: Cloudflare ==============
    if (media.cloudflare?.id) {
      try {
        // You can integrate your Cloudflare delete logic here.
        // For example:
        //
        // await deleteFromCloudflare(media.cloudflare.id);
        //
        // (You’d define deleteFromCloudflare to call Cloudflare’s Images API)
      } catch (cloudErr) {
        console.error(`⚠️ Cloudflare deletion failed:`, cloudErr);
      }

      return; // Exit early — nothing to delete locally.
    }

    // ============ 💾 CASE 2: Local File System ==========
    const filename = media.cloudflare?.filename || path.basename(media.path || "");

    if (!filename) { console.warn("⚠️ No filename found for media_id:", media_id); return; }

    let cleanedPath = media.path?.replace(/^[/\\]*storage[/\\]*/, "") || "";
    const relativeDir = path.dirname(cleanedPath);

    const variants = [
      path.join(MEDIA_PATH, relativeDir, filename),
      path.join(MEDIA_PATH, relativeDir, "small", filename),
      path.join(MEDIA_PATH, relativeDir, "thumbnail", filename),
    ];

    for (const filePath of variants) {
      fs.unlink(filePath, (error) => {
        if (error && error.code !== "ENOENT") {
          console.error("❌ File delete error:", error);
        }
      });
    }

  } catch (error) {
    console.error("deleteOldImage error:", error);
  }
};

export const uploadMedia = async ({ file, name = "amitkk", pathType, media_id = null, user_id = null }: UploadMediaParams): Promise<string | null> => {
  try {
    // return await uploadMediaToS3({ file, name, pathType, media_id, user_id });
    return uploadMediaToLocal({ file, name, pathType, media_id, user_id });
  } catch (error) { await logError(error, { function: "uploadMedia", payload: { name, pathType, media_id, user_id } }); return null; } 
};

export const uploadMediaToLocal = async ({ file, name, pathType, media_id = null, user_id = null }: UploadMediaParams) => {  
  try {
    if ( !file ) { return media_id ? media_id : null; }

    if (file && media_id && isValidObjectId(media_id)) {
      await deleteOldImage(Media, media_id);
    }
    const { folder, small, thumbnail } = getPaths(pathType);
    const basePath = path.join(MEDIA_PATH, folder);
    ensureDirs(basePath, small, thumbnail);
    const originalName = (file as any).originalFilename || 'file.jpg';
    const ext = path.extname(originalName);
    const filename = getUniqueFilename(basePath, name, originalName, ext);
    const finalPath = path.join(basePath, filename);

    fs.renameSync(file.filepath, finalPath);
    if (small.length) {
      await resizeImage(finalPath, path.join(basePath, 'small', filename), small);
    }

    if (thumbnail.length) {
      await resizeImage(finalPath, path.join(basePath, 'thumbnail', filename), thumbnail);
    }

    let entry;
    const storagePath = `/storage/${folder}/${filename}`;  
    const resolvedName = name ? name : "AMITKKAUS";

    if (file && media_id && isValidObjectId(media_id)) {
      entry = await Media.findByIdAndUpdate(
        media_id,
        { media: filename, path: storagePath, user_id : user_id },
        { new: true }
      );
    } else {
      entry = await Media.create({ media: filename, alt: resolvedName, path: storagePath, user_id : user_id });
    }

    return entry._id.toString(); 
  } catch (error) { await logError(error, { function: "uploadMediaToLocal", payload: { name, pathType, media_id, user_id } }); } 
};