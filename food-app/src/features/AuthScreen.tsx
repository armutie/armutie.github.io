import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Camera, Check, ClipboardList, Pencil, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandMark } from "@/components/BrandMark";
import { Disclaimer } from "@/components/Disclaimer";
import { Button } from "@/components/ui/button";
import type { AuthService } from "@/services/interfaces";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export function AuthScreen({ auth }: { auth: AuthService }) {
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    setFocus,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const submit = handleSubmit(async ({ email }) => {
    setSubmitError("");
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await auth.sendMagicLink(normalizedEmail);
      setSentEmail(normalizedEmail);
    } catch (error) {
      console.error("Authentication failed", error);
      setSubmitError("The sign-in email could not be sent. Check the address and try again.");
    }
  });

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="A balanced meal ready to photograph">
        <img src={`${import.meta.env.BASE_URL}demo-meal.png`} alt="Grilled chicken, sweet potato, broccoli, herb sauce, and a loonie on a plate" />
        <div className="auth-brand">
          <BrandMark />
          <span>Plateful</span>
        </div>
      </section>
      <section className="auth-copy">
        <p className="eyebrow">A meal journal with a second look</p>
        <h1>Photograph it. Review it. Make the estimate yours.</h1>
        <div className="auth-steps">
          <div><Camera /><span><strong>Photograph</strong> your meal</span></div>
          <div><Sparkles /><span><strong>Review</strong> the AI estimate</span></div>
          <div><ClipboardList /><span><strong>Correct and track</strong> what matters</span></div>
        </div>
        {sentEmail ? (
          <div className="auth-sent" role="status">
            <Check aria-hidden="true" />
            <div>
              <strong>Check your inbox</strong>
              <p>
                We sent a secure sign-in link to <strong className="auth-sent-email">{sentEmail}</strong>.
              </p>
              <Button
                variant="ghost"
                size="small"
                onClick={() => {
                  setValue("email", sentEmail);
                  setSentEmail(null);
                  window.setTimeout(() => setFocus("email"), 0);
                }}
              >
                <Pencil size={15} />
                Change email
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
              {errors.email && <p className="field-error" role="alert">{errors.email.message}</p>}
            </div>
            {submitError && <p className="form-error" role="alert">{submitError}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending link..." : "Continue with email"}
              <ArrowRight size={18} />
            </Button>
          </form>
        )}
        <p className="auth-privacy">No password required. Your meals remain private to your account.</p>
        <Disclaimer />
      </section>
    </main>
  );
}
