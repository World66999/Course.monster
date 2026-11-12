"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/lib/toast";
import { displayNameFormSchema } from "@/lib/validation";
import { updateDisplayNameAction } from "@/server/actions/profile";
import { safeAction } from "@/lib/safe-action";
import { AvatarUpload } from "@/components/account/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, FieldHint } from "@/components/ui/input";

interface FormValues {
  name: string;
}

export function ProfileSection({ name, image }: { name: string; image: string | null }) {
  const router = useRouter();
  const { update } = useSession();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(displayNameFormSchema),
    defaultValues: { name },
  });

  async function onSubmit(values: FormValues) {
    const result = await safeAction(() => updateDisplayNameAction(values), "update display name");
    if (result.ok) {
      toast.success("Display name updated");
      // Pushes the new name into the JWT/session immediately — the header
      // avatar menu reads session.user.name, which otherwise only reflects
      // DB changes after the next full sign-in.
      await update({ name: values.name });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <section className="space-y-5 rounded-card border border-border bg-card p-6 shadow-soft">
      <div>
        <h2 className="font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Shown publicly on your reviews.</p>
      </div>
      <AvatarUpload name={name} image={image} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" {...register("name")} />
          <FieldHint>This is the only name shown alongside your reviews.</FieldHint>
          <FieldError message={errors.name?.message} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            Save
          </Button>
        </div>
      </form>
    </section>
  );
}
