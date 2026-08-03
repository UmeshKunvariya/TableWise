"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { uniqueSlug } from "@/lib/slug";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, "Enter your name"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  phone: z.string().min(6, "Enter a contact number"),
  restaurantName: z.string().min(2, "Enter the restaurant name"),
  address: z.string().min(5, "Enter the full address"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  timezone: z.string().min(1).default("UTC"),
});

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague: distinguishing "no such user" from "wrong password"
    // turns the login form into an account-enumeration oracle.
    return { error: "Those details don't match an account." };
  }

  redirect("/dashboard");
}

export async function signUpOwner(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const {
    fullName,
    email,
    password,
    phone,
    restaurantName,
    address,
    lat,
    lng,
    timezone,
  } = parsed.data;

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  // With email confirmation enabled there is no session yet, so the registration
  // RPC (which runs as auth.uid()) cannot be called. Tell them to confirm first.
  if (!signUpData.session) {
    return {
      error:
        "Check your email to confirm your address, then sign in to finish registering your restaurant.",
    };
  }

  const { error: rpcError } = await supabase.rpc("register_restaurant", {
    p_full_name: fullName,
    p_phone: phone,
    p_restaurant_name: restaurantName,
    p_slug: uniqueSlug(restaurantName),
    p_address: address,
    p_lat: lat,
    p_lng: lng,
    p_timezone: timezone,
  });

  if (rpcError) {
    return { error: `Could not register the restaurant: ${rpcError.message}` };
  }

  redirect("/pending");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
