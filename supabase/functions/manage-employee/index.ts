import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

function jsonError(status: number, message: string, detail?: string) {
  return new Response(
    JSON.stringify({ error: message, detail: detail ?? null }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generatePassword(length = 16): string {
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!supabaseUrl) return jsonError(500, "missing configuration: SUPABASE_URL");
    if (!serviceRoleKey) return jsonError(500, "missing configuration: SUPABASE_SERVICE_ROLE_KEY");
    if (!anonKey) return jsonError(500, "missing configuration: SUPABASE_ANON_KEY");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError(401, "not authenticated", "Missing Authorization header");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonError(401, "not authenticated", "Invalid or expired token");
    }

    const callerId = userData.user.id;

    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, garage_id")
      .eq("id", callerId)
      .maybeSingle();

    if (profileError) {
      return jsonError(403, "failed to fetch caller profile", profileError.message);
    }
    if (!callerProfile) {
      return jsonError(403, "caller profile not found");
    }
    if (callerProfile.role !== "admin") {
      return jsonError(403, "not authorized", "Only garage admins can manage employees");
    }
    if (!callerProfile.garage_id) {
      return jsonError(400, "no garage associated", "Caller has no garage_id");
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, full_name, role, phone } = body;

      if (!email) return jsonError(400, "missing field: email");
      if (!full_name) return jsonError(400, "missing field: full_name");
      if (!role) return jsonError(400, "missing field: role");

      if (role !== "mecanicien" && role !== "secretaire") {
        return jsonError(400, "invalid role", "Can only create mecanicien or secretaire");
      }

      const tempPassword = generatePassword();

      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createError) {
        const msg = createError.message.toLowerCase();
        if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
          return jsonError(409, "email already exists", createError.message);
        }
        return jsonError(400, "failed to create auth user", createError.message);
      }

      if (!authUser?.user?.id) {
        return jsonError(500, "failed to create auth user", "No user id returned");
      }

      const { error: upsertError } = await adminClient
        .from("profiles")
        .upsert({
          id: authUser.user.id,
          email,
          full_name,
          role,
          phone: phone || null,
          garage_id: callerProfile.garage_id,
          must_change_password: true,
        }, { onConflict: "id" });

      if (upsertError) {
        await adminClient.auth.admin.deleteUser(authUser.user.id);
        return jsonError(500, "failed to create profile", upsertError.message);
      }

      return new Response(JSON.stringify({ temp_password: tempPassword }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { target_user_id } = body;

      if (!target_user_id) {
        return jsonError(400, "missing field: target_user_id");
      }
      if (target_user_id === callerId) {
        return jsonError(400, "cannot reset own password");
      }

      const { data: targetProfile, error: targetError } = await adminClient
        .from("profiles")
        .select("garage_id")
        .eq("id", target_user_id)
        .maybeSingle();

      if (targetError) {
        return jsonError(500, "failed to fetch target profile", targetError.message);
      }
      if (!targetProfile) {
        return jsonError(404, "target user not found");
      }
      if (targetProfile.garage_id !== callerProfile.garage_id) {
        return jsonError(403, "target not in your garage");
      }

      const tempPassword = generatePassword();

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        target_user_id,
        { password: tempPassword },
      );

      if (updateError) {
        return jsonError(500, "failed to reset password", updateError.message);
      }

      await adminClient
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", target_user_id);

      return new Response(JSON.stringify({ temp_password: tempPassword }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return jsonError(400, "invalid action", `Unknown action: ${action ?? "none"}`);
  } catch (err) {
    console.error("manage-employee unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, "unexpected error", message);
  }
});
