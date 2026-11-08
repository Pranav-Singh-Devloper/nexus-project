import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';
import { Logo } from '../components/ui';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { ease, fadeUp, stagger } from '../lib/motion';

const LegalPage = ({ icon: Icon, title, sections }) => (
  <div className="relative min-h-screen bg-bg">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-dots [mask-image:linear-gradient(to_bottom,black,transparent)]" />
    <header className="relative mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
      <Link to="/" aria-label="Nexus home"><Logo /></Link>
      <ThemeToggle />
    </header>

    <motion.main initial="hidden" animate="show" variants={stagger(0.06)} className="relative mx-auto max-w-3xl px-5 pb-20">
      <motion.div variants={fadeUp} className="mb-8 mt-6">
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent-ink">
          <Icon className="h-6 w-6" />
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Last updated {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
      </motion.div>

      <motion.div variants={fadeUp} className="card divide-y divide-line">
        {sections.map(([heading, body], i) => (
          <motion.section
            key={heading}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease, delay: i * 0.03 }}
            className="group flex gap-5 p-6 sm:p-8"
          >
            <span className="font-display text-2xl font-semibold text-accent-ink/70 transition-colors group-hover:text-accent-ink">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">{heading}</h2>
              <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
            </div>
          </motion.section>
        ))}
      </motion.div>

      <motion.div variants={fadeUp} className="mt-10 text-center">
        <Link to="/" className="group inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Return to home
        </Link>
      </motion.div>
    </motion.main>
  </div>
);

export const Policy = () => (
  <LegalPage
    icon={ShieldCheck}
    title="Privacy Policy"
    sections={[
      ['Information we collect', 'We collect information you provide directly to us when you create an account or connect third-party services like LinkedIn and X (Twitter). This includes your name, email address, profile pictures, and access tokens for connected platforms.'],
      ['How we use your information', 'We use the information we collect to provide, maintain, and improve our services, authenticate your identity, and post to your connected social media accounts strictly on your behalf when authorized.'],
      ['Third-party access', 'When you connect external accounts (such as X or LinkedIn), we store the necessary authentication tokens to perform actions you request. We do not sell or share these credentials with anyone else.'],
      ['Your rights', 'You may disconnect your social accounts at any time from your profile page, which will revoke our access and remove the corresponding tokens from our database.'],
      ['Contact us', 'If you have any questions about this Privacy Policy, please contact us.'],
    ]}
  />
);

export const Service = () => (
  <LegalPage
    icon={FileText}
    title="Terms of Service"
    sections={[
      ['Acceptance of terms', 'By accessing and using Nexus, you accept and agree to be bound by the terms and provision of this agreement.'],
      ['Description of service', 'Nexus provides market intelligence tools and social media integration services, allowing users to schedule and publish content to third-party platforms.'],
      ['User conduct', 'You agree to use the service only for lawful purposes. You agree not to take any action that might compromise the security of the service, render the service inaccessible to others, or otherwise cause damage to the service or the Content.'],
      ['Third-party services', 'Our Service may contain links to or integrations with third-party web sites or services (e.g., X, LinkedIn) that are not owned or controlled by us. We assume no responsibility for the content, privacy policies, or practices of any third party web sites or services.'],
      ['Termination', 'We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.'],
    ]}
  />
);
