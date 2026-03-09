import { useState, useEffect } from "react";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";

interface Story {
  imageUrl: string;
  category: string;
  title: string;
  excerpt: string;
  author: string;
  time: string;
}

interface FeaturedStoryProps {
  stories: Story[];
  /** When true, hide author and time (e.g. for intro/feature slides) */
  hideByline?: boolean;
}

export function FeaturedStory({ stories, hideByline }: FeaturedStoryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance slideshow every 5 seconds
  useEffect(() => {
    if (!isAutoPlaying || stories.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % stories.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, stories.length]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + stories.length) % stories.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % stories.length);
  };

  const goToSlide = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  if (!stories || stories.length === 0) {
    return null;
  }

  const currentStory = stories[currentIndex];

  return (
    <div className="relative">
      <article className="relative border-2 border-gray-300 bg-white">
        {/* Image Placeholder */}
        <div className="aspect-[16/9] bg-gray-200 flex items-center justify-center border-b-2 border-gray-300">
          <span className="text-gray-400 text-sm">
            {hideByline ? `[INTRO SLIDE ${currentIndex + 1}]` : `[BREAKING NEWS IMAGE ${currentIndex + 1}]`}
          </span>
        </div>
        
        {/* Content Area */}
        <div className="p-6">
          <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase mb-3">
            {currentStory.category}
          </span>
          <h2 className="text-2xl font-bold mb-3">
            {currentStory.title}
          </h2>
          <p className="text-gray-600 mb-4">
            {currentStory.excerpt}
          </p>
          {!hideByline && (currentStory.author || currentStory.time) && (
            <div className="flex items-center gap-3 text-sm text-gray-500">
              {currentStory.author && <span>By {currentStory.author}</span>}
              {currentStory.author && currentStory.time && <span>•</span>}
              {currentStory.time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{currentStory.time}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Arrows - Only show if more than 1 story */}
        {stories.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border-2 border-gray-400 hover:bg-gray-100 flex items-center justify-center transition-all"
              aria-label="Previous story"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border-2 border-gray-400 hover:bg-gray-100 flex items-center justify-center transition-all"
              aria-label="Next story"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Auto-play indicator */}
        {stories.length > 1 && (
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="px-3 py-1 bg-black text-white text-xs border border-gray-400"
            >
              {isAutoPlaying ? "Auto ▶" : "Paused ⏸"}
            </button>
          </div>
        )}
      </article>

      {/* Slide Indicators - Only show if more than 1 story */}
      {stories.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {stories.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-3 w-3 border-2 border-black transition-all ${
                index === currentIndex 
                  ? "bg-black" 
                  : "bg-white hover:bg-gray-200"
              }`}
              aria-label={`Go to story ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}