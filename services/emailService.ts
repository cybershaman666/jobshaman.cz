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