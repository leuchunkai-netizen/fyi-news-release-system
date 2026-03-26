import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getGuestLandingSettings, getIntroSlides } from "@/lib/api";

export interface IntroSlide {
  category: string;
  title: string;
  excerpt: string;
  imageUrl: string;
}

export interface VideoSection {
  title: string;
  description: string;
  videoUrl: string;
}

const defaultIntroSlides: IntroSlide[] = [
  { category: "Features", title: "Curated News", excerpt: "Stay informed with trusted, up-to-date stories from verified sources.", imageUrl: "" },
  { category: "Features", title: "Expert Verification", excerpt: "Articles can be reviewed and verified by experts for extra credibility.", imageUrl: "" },
  { category: "Features", title: "AI Summaries", excerpt: "Get quick AI-powered summaries so you can catch up on the news in less time.", imageUrl: "" },
  { category: "Features", title: "Bookmarks & Personalization", excerpt: "Save articles and tailor your feed to the topics you care about most.", imageUrl: "" },
];

const defaultVideoSection: VideoSection = {
  title: "Welcome to our platform",
  description: "Watch a short introduction to our features and how to get the most out of the site.",
  videoUrl: "",
};

interface GuestLandingState {
  introSlides: IntroSlide[];
  videoSection: VideoSection;
}

interface GuestLandingContextType {
  introSlides: IntroSlide[];
  videoSection: VideoSection;
  setIntroSlides: (slides: IntroSlide[]) => void;
  setVideoSection: (section: VideoSection) => void;
}

const GuestLandingContext = createContext<GuestLandingContextType | undefined>(undefined);

export function GuestLandingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuestLandingState>({
    introSlides: defaultIntroSlides,
    videoSection: defaultVideoSection,
  });

  useEffect(() => {
    Promise.all([getGuestLandingSettings(), getIntroSlides()])
      .then(([settings, slides]) => {
        setState((prev) => ({
          introSlides:
            slides.length > 0
              ? slides.map((s) => ({ category: s.category, title: s.title, excerpt: s.excerpt, imageUrl: s.image_url ?? "" }))
              : prev.introSlides,
          videoSection: settings
            ? {
                title: settings.video_title,
                description: settings.video_description ?? "",
                videoUrl: settings.video_url ?? "",
              }
            : prev.videoSection,
        }));
      })
      .catch(() => {
        /* keep defaults on error */
      });
  }, []);

  const setIntroSlides = (introSlides: IntroSlide[]) => {
    setState((prev) => ({ ...prev, introSlides }));
  };

  const setVideoSection = (videoSection: VideoSection) => {
    setState((prev) => ({ ...prev, videoSection }));
  };

  return (
    <GuestLandingContext.Provider
      value={{
        introSlides: state.introSlides,
        videoSection: state.videoSection,
        setIntroSlides,
        setVideoSection,
      }}
    >
      {children}
    </GuestLandingContext.Provider>
  );
}

export function useGuestLanding() {
  const context = useContext(GuestLandingContext);
  if (context === undefined) {
    throw new Error("useGuestLanding must be used within a GuestLandingProvider");
  }
  return context;
}
