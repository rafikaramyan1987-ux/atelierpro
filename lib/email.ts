export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ to, subject, html, text }),
    });
  } catch {
    // Silently fail — email is best-effort
  }
}

export function appointmentConfirmedEmail(clientName: string, serviceType: string, date: string, time: string, garageNotes?: string) {
  return {
    subject: 'Votre rendez-vous est confirmé — AtelierPro',
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="color:#1e3a8a;">Rendez-vous confirmé</h1><p>Bonjour ${clientName},</p><p>Votre rendez-vous pour <strong>${serviceType}</strong> a été confirmé par le garage.</p><div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:4px 0;"><strong>Date :</strong> ${date}</p><p style="margin:4px 0;"><strong>Heure :</strong> ${time}</p>${garageNotes ? `<p style="margin:4px 0;"><strong>Note du garage :</strong> ${garageNotes}</p>` : ''}</div><p>Connectez-vous à votre espace AtelierPro pour voir les détails.</p><p style="color:#6b7280;font-size:14px;margin-top:24px;">AtelierPro — La plateforme automobile suisse</p></div>`,
    text: `Votre rendez-vous pour ${serviceType} a été confirmé. Date: ${date}, Heure: ${time}. ${garageNotes ? 'Note du garage: ' + garageNotes : ''}`,
  };
}

export function devisResponseEmail(clientName: string, description: string, totalAmount?: string) {
  return {
    subject: 'Réponse à votre demande de devis — AtelierPro',
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="color:#1e3a8a;">Devis reçu</h1><p>Bonjour ${clientName},</p><p>Le garage a répondu à votre demande de devis pour : <strong>${description}</strong></p>${totalAmount ? `<p>Montant total : <strong>${totalAmount}</strong></p>` : ''}<p>Connectez-vous à votre espace AtelierPro pour voir le détail et accepter ou refuser le devis.</p><p style="color:#6b7280;font-size:14px;margin-top:24px;">AtelierPro — La plateforme automobile suisse</p></div>`,
    text: `Le garage a répondu à votre demande de devis pour: ${description}. ${totalAmount ? 'Montant: ' + totalAmount : ''} Connectez-vous pour voir le détail.`,
  };
}

export function newAppointmentEmail(clientName: string, serviceType: string, date: string, time: string, vehicle?: string) {
  return {
    subject: 'Nouveau rendez-vous — AtelierPro',
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="color:#1e3a8a;">Nouveau rendez-vous</h1><p>Un nouveau rendez-vous a été demandé par <strong>${clientName}</strong>.</p><div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:4px 0;"><strong>Service :</strong> ${serviceType}</p><p style="margin:4px 0;"><strong>Date souhaitée :</strong> ${date}</p><p style="margin:4px 0;"><strong>Heure souhaitée :</strong> ${time}</p>${vehicle ? `<p style="margin:4px 0;"><strong>Véhicule :</strong> ${vehicle}</p>` : ''}</div><p>Connectez-vous à votre espace garage pour confirmer ou refuser ce rendez-vous.</p><p style="color:#6b7280;font-size:14px;margin-top:24px;">AtelierPro — La plateforme automobile suisse</p></div>`,
    text: `Nouveau rendez-vous de ${clientName} pour ${serviceType}. Date: ${date}, Heure: ${time}. ${vehicle ? 'Véhicule: ' + vehicle : ''}`,
  };
}

export function newDevisEmail(clientName: string, description: string, vehicle?: string) {
  return {
    subject: 'Nouvelle demande de devis — AtelierPro',
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="color:#1e3a8a;">Nouvelle demande de devis</h1><p>Une nouvelle demande de devis a été soumise par <strong>${clientName}</strong>.</p><div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:4px 0;"><strong>Description :</strong> ${description}</p>${vehicle ? `<p style="margin:4px 0;"><strong>Véhicule :</strong> ${vehicle}</p>` : ''}</div><p>Connectez-vous à votre espace garage pour répondre à cette demande.</p><p style="color:#6b7280;font-size:14px;margin-top:24px;">AtelierPro — La plateforme automobile suisse</p></div>`,
    text: `Nouvelle demande de devis de ${clientName}: ${description}. ${vehicle ? 'Véhicule: ' + vehicle : ''}`,
  };
}

export function serviceReminderEmail(clientName: string, vehicleLabel: string, serviceName: string, dueReason: string) {
  return {
    subject: 'Votre véhicule est dû pour un entretien — AtelierPro',
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="color:#1e3a8a;">Entretien à prévoir</h1><p>Bonjour ${clientName},</p><p>Votre véhicule <strong>${vehicleLabel}</strong> est dû pour l'entretien suivant : <strong>${serviceName}</strong>.</p><p style="background:#fef3c7;padding:12px;border-radius:8px;margin:16px 0;">${dueReason}</p><p>Connectez-vous à votre espace AtelierPro pour prendre rendez-vous dès maintenant.</p><p style="color:#6b7280;font-size:14px;margin-top:24px;">AtelierPro — La plateforme automobile suisse</p></div>`,
    text: `Bonjour ${clientName}, votre véhicule ${vehicleLabel} est dû pour: ${serviceName}. ${dueReason} Connectez-vous pour prendre rendez-vous.`,
  };
}
