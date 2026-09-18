import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user client to verify the caller
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;

    // Fetch caller's profile
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, garage_id")
      .eq("id", callerId)
      .maybeSingle();

    if (profileError || !callerProfile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can manage employees" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!callerProfile.garage_id) {
      return new Response(JSON.stringify({ error: "No garage associated" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, full_name, role, phone } = body;

      if (!email || !full_name || !role) {
        return new Response(JSON.stringify({ error: "email, full_name, role required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (role !== "mecanicien" && role !== "secretaire") {
        return new Response(JSON.stringify({ error: "Can only create mecanicien or secretaire" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tempPassword = generatePassword();

      // Create auth user using Admin API
      const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert profile with correct role, garage_id, phone, must_change_password
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
        // Try to clean up the auth user if profile fails
        await adminClient.auth.admin.deleteUser(authUser.user.id);
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ temp_password: tempPassword }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { target_user_id } = body;

      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "target_user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (target_user_id === callerId) {
        return new Response(JSON.stringify({ error: "Cannot reset own password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify target is in the same garage
      const { data: targetProfile, error: targetError } = await adminClient
        .from("profiles")
        .select("garage_id")
        .eq("id", target_user_id)
        .maybeSingle();

      if (targetError || !targetProfile) {
        return new Response(JSON.stringify({ error: "Target user not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (targetProfile.garage_id !== callerProfile.garage_id) {
        return new Response(JSON.stringify({ error: "Target not in your garage" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tempPassword = generatePassword();

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        target_user_id,
        { password: tempPassword }
      );

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Set must_change_password flag
      await adminClient
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", target_user_id);

      return new Response(JSON.stringify({ temp_password: tempPassword }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-employee error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
