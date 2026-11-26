import { useState } from "react";
import Image from "next/image";
import type { ReviewProps } from "@amitkk/basic/types";
import ReviewForm from "./ReviewForm";
import { MediaProps } from "@amitkk/basic/types/media";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function ReviewPanel({ reviews, module, module_id }: { reviews: ReviewProps[]; module: string; module_id: string }) {
  console.log("reviews", reviews)
  const [starSelected, setStarSelected] = useState<number | null>(null);
  const [activeReview, setActiveReview] = useState<ReviewProps | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = starSelected ? reviews.filter((r) => r.rating === starSelected) : reviews;
  const mediaList = activeReview?.mediaHub || [];

  const starCounts = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    const total = reviews.length || 1;
    return { star, percentage: Math.round((count / total) * 100) };
  });

  const open = (r: ReviewProps) => { setActiveReview(r); setIsModalOpen(true); setActiveIndex(0); };
  const close = () => setIsModalOpen(false);

  const prev = () => setActiveIndex((i) => (i === 0 ? mediaList.length - 1 : i - 1));
  const next = () => setActiveIndex((i) => (i === mediaList.length - 1 ? 0 : i + 1));

  return (
    <div className="container py-5 md:py-12">
      <h2 className="mb-6 text-xl font-bold">{starSelected ? `${starSelected} Star Reviews` : "All Reviews"}</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="mb-4 text-center text-sm">{reviews.length} Total Reviews</p>

          <div className="space-y-3">
            {starCounts.map(({ star, percentage }) => (
              <div key={star} onClick={() => setStarSelected(star)} className="flex cursor-pointer items-center gap-2">
                <span className="w-16 text-sm">{star} Star</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
                </div>
                <span className="w-10 text-xs">{percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-8 space-y-4">
          {filtered.map((r) => (
            <div key={String(r._id)} onClick={() => open(r)} className="cursor-pointer rounded-xl border p-4 hover:shadow-md">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm">
                  {typeof r.user_id === "object" ? r.user_id?.name?.charAt(0) : "U"}
                </div>
                <div>
                  <p className="font-semibold">{typeof r.user_id === "object" ? r.user_id?.name : "User"}</p>
                  <p className="text-xs text-gray-500">{new Date(r.updatedAt).toLocaleDateString("en-IN")}</p>
                </div>
              </div>

              <p className="mb-2 text-sm">{r.review}</p>

              {r.mediaHub && r.mediaHub?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {r.mediaHub.map((m) => (
                    <Image key={String((m.media_id as MediaProps)?._id)} src={(m.media_id as MediaProps)?.path} alt={(m.media_id as MediaProps)?.alt} width={80} height={60} className="rounded-md object-cover" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div onClick={close} className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-black/90 px-4 pt-20 pb-24 backdrop-blur-md">
          <div onClick={(e) => e.stopPropagation()} className="fixed inset-x-0 top-5 z-[110] flex items-center justify-end gap-3 px-6 md:px-10">
            <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/20 bg-black/60 px-3.5 py-1.5 text-xs font-medium tracking-wider text-white backdrop-blur-sm">
              {activeIndex + 1} / {mediaList.length}
            </span>

            <button type="button" onClick={close} aria-label="Close gallery" className="group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white hover:text-black active:scale-95">
              <X className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
            </button>
          </div>
          {mediaList.length > 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous image" className="group fixed left-4 md:left-8 top-1/2 z-[110] -translate-y-1/2 flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white hover:text-black active:scale-95">
              <ChevronLeft className="h-6 w-6 transition-transform duration-200 group-hover:-translate-x-0.5" />
            </button>
          )}
          
          <div onClick={(e) => e.stopPropagation()} className="relative flex max-h-[68vh] w-[86vw] max-w-4xl items-center justify-center overflow-hidden rounded-xl">
            <Image src={(mediaList[activeIndex]?.media_id as MediaProps)?.path} alt={(mediaList[activeIndex]?.media_id as MediaProps)?.alt || "Gallery image"} width={1000} height={600} className="max-h-[68vh] w-auto rounded-lg object-contain shadow-2xl select-none"/>
          </div>
    
          {mediaList.length > 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next image" className="group fixed right-4 md:right-8 top-1/2 z-[110] -translate-y-1/2 flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-white hover:text-black active:scale-95">
              <ChevronRight className="h-6 w-6 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          )}

          {mediaList.length > 1 && (
            <div onClick={(e) => e.stopPropagation()} className="fixed bottom-5 z-[110] flex max-w-[90vw] items-center gap-2.5 overflow-x-auto rounded-2xl border border-white/15 bg-black/60 p-2 backdrop-blur-md">
              {mediaList.map((m, i) => (
                <button key={String(m._id)} type="button" onClick={() => setActiveIndex(i)} className={`relative h-14 w-16 shrink-0 overflow-hidden rounded-lg transition-all duration-200 ${
                    i === activeIndex ? "ring-2 ring-white scale-105 opacity-100" : "opacity-50 hover:opacity-90"}`}>
                  <img src={(m?.media_id as MediaProps)?.path} alt={(m?.media_id as MediaProps)?.alt || `Thumbnail ${i + 1}`} className="h-full w-full object-cover"/>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ReviewForm module={module} module_id={module_id}/>
    </div>
  );
}