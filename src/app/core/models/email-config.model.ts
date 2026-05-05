/** Matches the backend `EmailProvider` enum. */
export enum EmailProvider {
  Smtp               = 0,
  Office365           = 1,
  Outlook             = 2,
  Gmail               = 3,
  Exchange            = 4,
  SendGridApi         = 5,
  AmazonSes           = 6,
  MailgunApi           = 7,
}

/** Human-readable labels for each provider. */
export const PROVIDER_LABELS: Record<EmailProvider, string> = {
  [EmailProvider.Smtp]:               'SMTP (Generic)',
  [EmailProvider.Office365]:           'Microsoft Office 365',
  [EmailProvider.Outlook]:             'Outlook.com',
  [EmailProvider.Gmail]:               'Gmail',
  [EmailProvider.Exchange]:            'Microsoft Exchange',
  [EmailProvider.SendGridApi]:         'SendGrid API',
  [EmailProvider.AmazonSes]:           'Amazon SES',
  [EmailProvider.MailgunApi]:           'Mailgun API',
};

/** True when the provider uses SMTP transport (SmtpClient). */
export function isSmtpProvider(p: EmailProvider): boolean {
  return [
    EmailProvider.Smtp,
    EmailProvider.Office365,
    EmailProvider.Outlook,
    EmailProvider.Gmail,
    EmailProvider.Exchange,
    EmailProvider.AmazonSes,
  ].includes(p);
}

/** True when the provider uses a REST API key. */
export function isApiProvider(p: EmailProvider): boolean {
  return [EmailProvider.SendGridApi, EmailProvider.MailgunApi].includes(p);
}

/** Matches `EmailConfigDto` on the server. Sensitive fields are masked. */
export interface EmailConfigDto {
  id:              string;
  tenantId:        string | null;
  name:            string;
  provider:        EmailProvider;
  isActive:        boolean;
  // SMTP
  smtpHost:        string | null;
  smtpPort:        number;
  username:        string | null;
  password:        string | null;   // masked
  enableSsl:       boolean;
  // Sender
  senderEmail:     string;
  senderName:      string;
  // API
  apiKey:          string | null;   // masked
  apiDomain:       string | null;
  awsRegion:       string | null;
  // Audit
  createdAt:       string;
  updatedAt:       string | null;
}

/** Matches `CreateEmailConfigRequest` / `UpdateEmailConfigRequest`. */
export interface EmailConfigRequest {
  name:            string;
  provider:        EmailProvider;
  isActive:        boolean;
  smtpHost?:       string | null;
  smtpPort?:       number | null;
  username?:       string | null;
  password?:       string | null;
  enableSsl?:      boolean | null;
  senderEmail:     string;
  senderName:      string;
  apiKey?:         string | null;
  apiDomain?:      string | null;
  awsRegion?:      string | null;
}

/** Matches `SendTestEmailResult`. */
export interface SendTestEmailResult {
  success:    boolean;
  message:    string;
}
