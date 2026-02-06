// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'EasyBiller Help Center',
			description: 'Guides and documentation for the EasyBiller platform — water billing, property management, and field operations.',
			customCss: [
				'./src/styles/custom.css',
			],
			head: [
				{
					tag: 'script',
					attrs: {
						src: 'https://cdnjs.cloudflare.com/ajax/libs/medium-zoom/1.1.0/medium-zoom.min.js',
						integrity: 'sha512-XBdaEpY0U3VXkwEzRUhS7Xa2WDfoCeXNUN2MjjjBl+KXLFkisMNR9EMGKlXislhRnFzScpD4Sjy3IHKPMPOQ7w==',
						crossorigin: 'anonymous',
						defer: true,
					},
				},
				{
					tag: 'script',
					content: `
						window.addEventListener('DOMContentLoaded', function() {
							if (typeof mediumZoom === 'undefined') return;
							mediumZoom('.sl-markdown-content img:not(.site-title img)', {
								margin: 24,
								background: 'var(--sl-color-bg)',
								scrollOffset: 0,
							});
						});
					`,
				},
			],
			social: [
				{ icon: 'email', label: 'Support', href: 'mailto:support@easybiller.com' },
			],
			editLink: {
				baseUrl: 'https://github.com/nelsonBlack/customer-help-portal/edit/main/',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Platform Overview', slug: 'getting-started/overview' },
						{ label: 'Quick Start for Admins', slug: 'getting-started/admin-quick-start' },
						{ label: 'Quick Start for Field Staff', slug: 'getting-started/field-staff-quick-start' },
						{ label: 'Quick Start for Tenants', slug: 'getting-started/tenant-quick-start' },
					],
				},
				{
					label: 'Water Billing',
					items: [
						{ label: 'Company Setup', slug: 'water-billing/company-setup' },
						{ label: 'Customers & Meters', slug: 'water-billing/customers-and-meters' },
						{ label: 'Capturing Meter Readings', slug: 'water-billing/meter-readings' },
						{ label: 'Generating Bills', slug: 'water-billing/generating-bills' },
						{ label: 'Recording Payments', slug: 'water-billing/payments' },
					],
				},
				{
					label: 'Real Estate',
					items: [
						{ label: 'Property & Unit Setup', slug: 'real-estate/property-setup' },
						{ label: 'Tenant Onboarding', slug: 'real-estate/tenant-onboarding' },
						{ label: 'Rent & Charges', slug: 'real-estate/rent-and-charges' },
						{ label: 'Lease Management', slug: 'real-estate/lease-management' },
					],
				},
				{
					label: 'Mobile App (EasyBill)',
					items: [
						{ label: 'Installation & First Login', slug: 'mobile/installation' },
						{ label: 'Readings in the Field', slug: 'mobile/field-readings' },
						{ label: 'Working Offline', slug: 'mobile/offline-mode' },
					],
				},
				{
					label: 'Account & Settings',
					items: [
						{ label: 'Team Management', slug: 'account/team-management' },
						{ label: 'Company Settings', slug: 'account/company-settings' },
						{ label: 'Notifications', slug: 'account/notifications' },
					],
				},
				{
					label: 'Troubleshooting',
					items: [
						{ label: 'Common Issues', slug: 'troubleshooting/common-issues' },
						{ label: 'FAQ', slug: 'troubleshooting/faq' },
					],
				},
			],
		}),
	],
});
