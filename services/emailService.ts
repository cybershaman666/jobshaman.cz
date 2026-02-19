import { Resend } from 'resend';

// Initialize Resend with API key from environment
const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

export interface EmailData {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export const sendEmail = async (emailData: EmailData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await resend.emails.send({
      from: emailData.from || 'JobShaman <noreply@jobshaman.cz>',
      to: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
      subject: emailData.subject,
      html: emailData.html,
      replyTo: emailData.replyTo || 'floki@jobshaman.cz',
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent successfully:', data);
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Templates for different email types
export const EmailTemplates = {
  welcomeCandidate: (payload: { name?: string; locale?: string; appUrl?: string }) => {
    const localeRaw = (payload.locale || 'cs').toLowerCase();
    const locale = localeRaw.startsWith('de') || localeRaw === 'at' ? 'de'
      : localeRaw.startsWith('sk') ? 'sk'
      : localeRaw.startsWith('pl') ? 'pl'
      : localeRaw.startsWith('en') ? 'en'
      : 'cs';

    const name = payload.name ? payload.name.split(' ')[0] : '';

    const copyByLocale: Record<string, { subject: string; title: string; body: string; cta: string; footer: string }> = {
      cs: {
        subject: 'Vítejte v JobShaman',
        title: `Ahoj${name ? ` ${name}` : ''}!`,
        body: 'Díky za registraci. Máte hotový účet a můžete začít hledat nabídky s chytrým filtrováním.',
        cta: 'Začít prohlížet nabídky',
        footer: 'Těšíme se, že vám JobShaman pomůže najít lepší práci.'
      },
      en: {
        subject: 'Welcome to JobShaman',
        title: `Hi${name ? ` ${name}` : ''}!`,
        body: 'Thanks for signing up. Your account is ready, and you can start browsing offers with smart filters.',
        cta: 'Start browsing jobs',
        footer: 'We are glad to help you find a better job with JobShaman.'
      },
      de: {
        subject: 'Willkommen bei JobShaman',
        title: `Hallo${name ? ` ${name}` : ''}!`,
        body: 'Danke für Ihre Registrierung. Ihr Konto ist bereit und Sie können sofort passende Angebote entdecken.',
        cta: 'Jobs ansehen',
        footer: 'Wir freuen uns, dass JobShaman bei der Jobsuche hilft.'
      },
      pl: {
        subject: 'Witamy w JobShaman',
        title: `Cześć${name ? ` ${name}` : ''}!`,
        body: 'Dziękujemy za rejestrację. Konto jest gotowe — możesz od razu przeglądać oferty.',
        cta: 'Przeglądaj oferty',
        footer: 'Cieszymy się, że JobShaman pomaga w znalezieniu lepszej pracy.'
      },
      sk: {
        subject: 'Vitajte v JobShaman',
        title: `Ahoj${name ? ` ${name}` : ''}!`,
        body: 'Ďakujeme za registráciu. Účet je pripravený a môžete začať prehliadať ponuky.',
        cta: 'Začať prehliadať ponuky',
        footer: 'Tešíme sa, že vám JobShaman pomôže nájsť lepšiu prácu.'
      }
    };

    const copy = copyByLocale[locale] || copyByLocale.cs;
    const appUrl = payload.appUrl || 'https://jobshaman.cz';

    return {
      subject: copy.subject,
      html: `
        <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;\">
          <div style=\"background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);\">
            <h2 style=\"color: #0f172a; margin-bottom: 12px;\">${copy.title}</h2>
            <p style=\"color: #475569; line-height: 1.6;\">${copy.body}</p>
            <div style=\"margin: 24px 0;\">
              <a href=\"${appUrl}\" style=\"display: inline-block; padding: 12px 20px; background-color: #0ea5e9; color: #ffffff; border-radius: 8px; text-decoration: none; font-weight: 600;\">${copy.cta}</a>
            </div>
            <p style=\"color: #64748b; font-size: 14px;\">${copy.footer}</p>
          </div>
          <div style=\"text-align: center; margin-top: 24px; color: #94a3b8; font-size: 12px;\">© 2024 JobShaman</div>
        </div>
      `
    };
  },
  companyRegistration: (formData: any) => ({
    subject: `Nová registrace společnosti: ${formData.companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1e40af; margin-bottom: 20px;">Nová registrace firmy na JobShaman</h2>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Základní údaje:</h3>
            <p><strong>Společnost:</strong> ${formData.companyName}</p>
            <p><strong>E-mail:</strong> ${formData.email}</p>
            <p><strong>Obor:</strong> ${formData.industry}</p>
            <p><strong>Počet zaměstnanců:</strong> ${formData.employees}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Kontaktní osoba:</h3>
            <p><strong>Jméno:</strong> ${formData.contactPerson}</p>
            <p><strong>Telefon:</strong> ${formData.phone}</p>
            <p><strong>Web:</strong> ${formData.website}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Popis činnosti:</h3>
            <p>${formData.description}</p>
          </div>
          
          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #1e40af;">
              <strong>Další kroky:</strong> Registraci je nutné schválit a aktivovat v admin rozhraní.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px;">
          <p>Tento e-mail byl vygenerován automaticky z portálu JobShaman.cz</p>
          <p>© 2024 JobShaman. Všechna práva vyhrazena.</p>
        </div>
      </div>
    `
  }),

  partnerOffer: (formData: any) => ({
    subject: `Nová poptávka partnerství: ${formData.companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1e40af; margin-bottom: 20px;">Nová poptávka partnerství na JobShaman</h2>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Údaje partnera:</h3>
            <p><strong>Společnost:</strong> ${formData.companyName}</p>
            <p><strong>Kontaktní osoba:</strong> ${formData.contactName}</p>
            <p><strong>E-mail:</strong> ${formData.email}</p>
            <p><strong>Telefon:</strong> ${formData.phone}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Nabídka:</h3>
            <p>${formData.offer}</p>
          </div>
          
          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #1e40af;">
              <strong>Další kroky:</strong> Poptávka bude posouzena a odpovězena do 48 hodin.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px;">
          <p>Tento e-mail byl vygenerován automaticky z portálu JobShaman.cz</p>
          <p>© 2024 JobShaman. Všechna práva vyhrazena.</p>
        </div>
      </div>
    `
  }),

  jobApplication: (formData: any, job: any) => ({
    subject: `Nová přihláška: ${formData.firstName} ${formData.lastName} na pozici ${job.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #1e40af; margin-bottom: 20px;">Nová přihláška na JobShaman</h2>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Informace o kandidátovi:</h3>
            <p><strong>Jméno:</strong> ${formData.firstName} ${formData.lastName}</p>
            <p><strong>E-mail:</strong> ${formData.email}</p>
            <p><strong>Telefon:</strong> ${formData.phone}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Pozice:</h3>
            <p><strong>Společnost:</strong> ${job.company}</p>
            <p><strong>Pozice:</strong> ${job.title}</p>
            <p><strong>Lokalita:</strong> ${job.location}</p>
          </div>
          
          ${formData.coverLetter ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Motivační dopis:</h3>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; white-space: pre-wrap; font-family: monospace; font-size: 12px;">
              ${formData.coverLetter.replace(/\n/g, '<br>')}
            </div>
          </div>
          ` : ''}
          
          ${formData.cvFile ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">CV:</h3>
            <p style="color: #059669;"><strong>✓ CV bylo nahráno</strong></p>
          </div>
          ` : ''}

          ${formData.cvSelectedName ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Vybrané CV:</h3>
            <p><strong>${formData.cvSelectedName}</strong></p>
            ${formData.cvSelectedUrl ? `<p><a href="${formData.cvSelectedUrl}" target="_blank" rel="noopener noreferrer">Otevřít CV</a></p>` : ''}
          </div>
          ` : ''}
          
          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #1e40af;">
              <strong>Další kroky:</strong> Profil kandidáta je k dispozici v admin rozhraní.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px;">
          <p>Tento e-mail byl vygenerován automaticky z portálu JobShaman.cz</p>
          <p>© 2024 JobShaman. Všechna práva vyhrazena.</p>
        </div>
      </div>
    `
  })
};

export default { sendEmail, EmailTemplates };
