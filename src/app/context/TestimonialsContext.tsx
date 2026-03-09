import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getApprovedTestimonials, submitTestimonial } from "@/lib/api";

export type TestimonialStatus = "pending" | "approved" | "rejected";

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  message: string;
  rating: number; // 1-5 stars
  status: TestimonialStatus;
}

interface TestimonialsContextType {
  /** Approved testimonials from database (for guest landing). */
  approvedTestimonials: Testimonial[];
  /** Submit a new testimonial; it will be pending until approved by admin. */
  addTestimonial: (testimonial: Omit<Testimonial, "id" | "status">, userId?: string | null) => Promise<void>;
  refetchApproved: () => Promise<void>;
}

const TestimonialsContext = createContext<TestimonialsContextType | undefined>(undefined);

export function TestimonialsProvider({ children }: { children: ReactNode }) {
  const [approvedFromDb, setApprovedFromDb] = useState<Testimonial[]>([]);

  const refetchApproved = useCallback(async () => {
    try {
      const rows = await getApprovedTestimonials();
      setApprovedFromDb(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          role: r.role,
          message: r.message,
          rating: r.rating,
          status: "approved" as const,
        }))
      );
    } catch {
      setApprovedFromDb([]);
    }
  }, []);

  useEffect(() => {
    refetchApproved();
  }, [refetchApproved]);

  const addTestimonial = useCallback(
    async (testimonial: Omit<Testimonial, "id" | "status">, userId?: string | null) => {
      await submitTestimonial({
        name: testimonial.name,
        role: testimonial.role,
        message: testimonial.message,
        rating: testimonial.rating,
        user_id: userId ?? null,
      });
      await refetchApproved();
    },
    [refetchApproved]
  );

  return (
    <TestimonialsContext.Provider value={{ approvedTestimonials: approvedFromDb, addTestimonial, refetchApproved }}>
      {children}
    </TestimonialsContext.Provider>
  );
}

export function useTestimonials() {
  const ctx = useContext(TestimonialsContext);
  if (!ctx) {
    throw new Error("useTestimonials must be used within a TestimonialsProvider");
  }
  return ctx;
}
