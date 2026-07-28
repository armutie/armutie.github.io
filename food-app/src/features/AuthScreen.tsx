import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Camera,
  Check,
  ClipboardList,
  LoaderCircle,
  Pencil,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandMark } from "@/components/BrandMark";
import { Disclaimer } from "@/components/Disclaimer";
import { Button } from "@/components/ui/button";
import { serviceErrorMessage } from "@/services/errors";
import type { AuthService } from "@/services/interfaces";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

type AuthScreenProps = {
  auth: AuthService;
  initialOAuthError?: string | null;
};

export function AuthScreen({ auth, initialOAuthError = null }: AuthScreenProps) {
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [oauthError, setOAuthError] = useState(initialOAuthError ?? "");
  const [isOAuthPending, setIsOAuthPending] = useState(false);
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
      setSubmitError(serviceErrorMessage(error));
    }
  });

  const signInWithGoogle = async () => {
    setOAuthError("");
    setIsOAuthPending(true);
    try {
      await auth.signInWithGoogle();
    } catch (error) {
      console.error("Google authentication failed", error);
      setOAuthError(serviceErrorMessage(error));
      setIsOAuthPending(false);
    }
  };

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
        <div className="auth-actions">
          <Button
            className="google-auth-button"
            onClick={() => void signInWithGoogle()}
            disabled={isOAuthPending || isSubmitting}
            aria-describedby={oauthError ? "google-auth-error" : undefined}
          >
            {isOAuthPending ? (
              <LoaderCircle className="button-spinner" size={19} aria-hidden="true" />
            ) : (
              <span className="google-mark" aria-hidden="true">G</span>
            )}
            {isOAuthPending ? "Connecting to Google..." : "Continue with Google"}
          </Button>
          {oauthError && (
            <p id="google-auth-error" className="form-error" role="alert">
              {oauthError}
            </p>
          )}

          <div className="auth-divider" aria-hidden="true">
            <span>or use email</span>
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
            <form onSubmit={submit} noValidate aria-busy={isSubmitting}>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={isOAuthPending}
                  {...register("email")}
                />
                {errors.email && <p className="field-error" role="alert">{errors.email.message}</p>}
              </div>
              {submitError && <p className="form-error" role="alert">{submitError}</p>}
              <Button type="submit" variant="secondary" disabled={isSubmitting || isOAuthPending}>
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="button-spinner" size={18} aria-hidden="true" />
                    Sending link...
                  </>
                ) : (
                  <>
                    Continue with email
                    <ArrowRight size={18} />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
        <p className="auth-privacy">No password required. Your meals remain private to your account.</p>
        <Disclaimer />
      </section>
    </main>
  );
}
