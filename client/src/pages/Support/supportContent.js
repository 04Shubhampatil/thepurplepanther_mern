/**
 * The customer-care copy, lifted verbatim from public/frontend/js/support-pages.js.
 *
 * support.blade.php renders an empty `<div id="support-app">` and that script fills it, so
 * this text — not the template — IS the page. It lives here as data rather than markup so
 * the renderer stays one component instead of nine near-identical ones.
 *
 * Block shapes: `lead` (the intro paragraph), `accordion` (question/answers pairs),
 * `paragraphs`, `sections` (nested h2 + paragraphs, used by Terms), `link`, `table`,
 * `benefits` and `form`. Each maps to markup the theme already styles.
 */
export const SUPPORT_ROUTES = [
  ['shipping', 'Shipping'],
  ['returns', 'Returns & Exchanges'],
  ['start-return', 'Start My Return'],
  ['international', 'International Customers'],
  ['size-guide', 'Size Guide'],
  ['faqs', 'FAQs'],
  ['terms', 'Terms and Conditions'],
  ['privacy', 'Privacy and Cookies Policy'],
  ['affiliates', 'Affiliates'],
]

export const SUPPORT_CONTENT = {
  shipping: {
    title: 'Shipping',
    blocks: [
      { type: 'lead', text: 'Thoughtful delivery for every Purple Panther order.' },
      {
        type: 'accordion',
        items: [
          ['Shipping', [
            'Your order will be dispatched within 3–5 business days.',
          ]],
          ['Delivery', [
            'Once dispatched, delivery will take approximately 5–7 business days to reach you.',
          ]],
          ['Order processing', [
            'Orders are prepared Monday through Friday. Please allow 1–2 business days for processing before dispatch.',
            'During launches and seasonal promotions, processing may require an additional business day.',
          ]],
          ['Domestic delivery', [
            'Standard delivery generally arrives within 3–7 business days after dispatch. Available delivery options and charges are shown at checkout.',
          ]],
          ['Tracking your order', [
            'When your order leaves our studio, a dispatch email with tracking details is sent to the email address used at checkout.',
          ]],
          ['Address changes', [
            'Contact customer care as soon as possible. Once an order has been dispatched, its delivery address cannot be changed.',
          ]],
          ['Lost or delayed parcels', [
            'If tracking has not updated for five business days, contact us with your order number so we can investigate with the carrier.',
          ]],
        ],
      },
    ],
  },

  returns: {
    title: 'Returns & Exchanges',
    blocks: [
      { type: 'lead', text: 'We want every piece to feel considered, comfortable, and right for you.' },
      {
        type: 'accordion',
        items: [
          ['Return eligibility', [
            'Unworn, unwashed items with original tags may be returned within 7 days of delivery. Items must be free from fragrance, makeup, marks, or alteration.',
          ]],
          ['Exchanges', [
            'Size exchanges are subject to availability. Start a return and select the exchange option; we will reserve the replacement when possible.',
          ]],
          ['Non-returnable items', [
            'Final-sale merchandise, gift cards, personalised products, and items marked non-returnable cannot be returned.',
          ]],
          ['Refund timing', [
            'Approved refunds are issued to the original payment method within 5–10 business days after inspection. Bank processing times may vary.',
          ]],
          ['Damaged or incorrect orders', [
            'Contact customer care within 48 hours of delivery with photographs and your order number. We will arrange the appropriate resolution.',
          ]],
        ],
      },
      { type: 'link', href: '/support/start-return', label: 'Start My Return' },
    ],
  },

  'start-return': {
    title: 'Start My Return',
    blocks: [
      { type: 'lead', text: 'Enter your order details to begin a return or exchange.' },
      {
        type: 'form',
        id: 'returnForm',
        submitLabel: 'Continue Return',
        rows: [
          [
            { label: 'Order number', name: 'order', required: true, placeholder: 'e.g. TPP-1048' },
            { label: 'Email address', name: 'email', type: 'email', required: true },
          ],
        ],
        fields: [
          {
            label: 'Reason for return',
            name: 'reason',
            control: 'select',
            required: true,
            options: [
              ['', 'Select a reason'],
              ['Size or fit', 'Size or fit'],
              ['Changed my mind', 'Changed my mind'],
              ['Item arrived damaged', 'Item arrived damaged'],
              ['Incorrect item received', 'Incorrect item received'],
            ],
          },
          { label: 'Additional details', name: 'details', control: 'textarea', rows: 5 },
        ],
        check: 'I confirm the item is unworn and has its original tags.',
      },
    ],
  },

  international: {
    title: 'International Customers',
    blocks: [
      { type: 'lead', text: 'Purple Panther pieces can travel beyond India.' },
      {
        type: 'accordion',
        items: [
          ['Available destinations', [
            'International availability is shown in the country selector at checkout. If your destination is unavailable, contact customer care for assistance.',
          ]],
          ['Duties and taxes', [
            'Import duties, taxes, and brokerage charges are determined by the destination country and are the customer’s responsibility unless checkout states otherwise.',
          ]],
          ['Delivery estimates', [
            'International delivery generally requires 7–18 business days after dispatch. Customs inspections may extend this timeframe.',
          ]],
          ['International returns', [
            'International customers may request a return within 7 days of delivery. Return postage, duties, and taxes are not refundable.',
          ]],
          ['Currency and payment', [
            'Displayed currency may be estimated. Your card provider determines the final conversion rate and may apply international transaction fees.',
          ]],
        ],
      },
    ],
  },

  'size-guide': {
    title: 'Size Guide',
    blocks: [
      {
        type: 'lead',
        text: 'Use your body measurements to select the closest size. Measurements are shown in inches.',
      },
      {
        type: 'table',
        rows: [
          ['XS', '32″', '28″', '36″', '15″', '14″'],
          ['S', '34″', '30″', '38″', '16″', '14.5″'],
          ['M', '36″', '32″', '40″', '17.5″', '15″'],
          ['L', '38″', '34″', '42″', '19″', '15.5″'],
          ['XL', '40″', '36″', '44″', '20.5″', '16″'],
          ['XXL', '42″', '38″', '46″', '21.5″', '16.5″'],
        ],
      },
      {
        type: 'accordion',
        items: [
          ['How to measure', [
            'Bust: measure around the fullest part of your chest. Waist: measure around your natural waist. Hip: measure around the fullest part of your seat.',
          ]],
          ['Between sizes', [
            'Choose the larger size for a relaxed fit or the smaller size for a closer fit. Refer to the fit note on each product page.',
          ]],
          ['Need assistance?', [
            'Contact customer care with your measurements and the product name for personalised sizing guidance.',
          ]],
        ],
      },
    ],
  },

  faqs: {
    title: 'FAQs',
    blocks: [
      {
        type: 'accordion',
        items: [
          ['Orders', [
            'Orders can be reviewed immediately after checkout. If you need to request a change, contact customer care before dispatch.',
          ]],
          ['Payment', [
            'We accept the payment methods displayed at checkout. Payments are securely processed and charged when the order is confirmed.',
          ]],
          ['Shipping and delivery', [
            'Domestic delivery generally takes 3–7 business days after dispatch. Tracking is provided by email.',
          ]],
          ['Return Eligibility', [
            'We do not offer refunds. If you are not satisfied with your purchase, the product may be exchanged within 7 days of delivery, provided it is unworn, unwashed, unused, and has its original tags attached. Items must be free from fragrance, makeup, marks, or alterations.',
          ]],
          ['Exchanges', [
            'You may exchange your purchase for another available product within the same price range. Exchanges are subject to product availability. <br> <br>  Alternatively, you may opt for a store coupon worth the value of your original purchase, which can be redeemed within 45 days from the date of issue.<br> <br>  Please note: All purchases are eligible for exchange or store credit only. No refunds will be provided.',
          ]],
          ['Miscellaneous', [
            'For product care, availability, gifting, or styling questions, contact our customer care team.',
          ]],
          ['Sale returns', [
            'Items marked final sale are not returnable. Other promotional items follow the eligibility shown on their product page.',
          ]],
          ['Gift cards', [
            'Gift cards are delivered electronically, cannot be exchanged for cash, and are non-refundable.',
          ]],
        ],
      },
    ],
  },

  terms: {
    title: 'Terms and Conditions',
    blocks: [
      { type: 'lead', text: 'Effective 11 August 2026' },
      {
        type: 'sections',
        items: [
          ['Use of this website', [
            'By accessing this website, you agree to use it lawfully and in accordance with these terms. Content, product descriptions, photography, and branding remain the property of The Purple Panther.',
          ]],
          ['Orders and availability', [
            'All orders are subject to acceptance and product availability. We may cancel or limit an order where pricing, inventory, payment, or fraud-screening issues occur.',
          ]],
          ['Pricing and payment', [
            'Prices and applicable taxes are displayed at checkout. We may correct inadvertent errors before dispatch and will contact you if an order is affected.',
          ]],
          ['Liability', [
            'Nothing in these terms excludes rights that cannot lawfully be excluded. To the extent permitted by law, our liability is limited to the value of the affected purchase.',
          ]],
          ['Changes', [
            'We may update these terms periodically. The version displayed at the time of purchase applies to that transaction.',
          ]],
        ],
      },
    ],
  },

  privacy: {
    title: 'Privacy and Cookies Policy',
    blocks: [
      { type: 'lead', text: 'Effective 11 August 2026' },
      {
        type: 'accordion',
        items: [
          ['Information we collect', [
            'We collect information you provide during checkout, account creation, customer-care enquiries, returns, and newsletter registration.',
          ]],
          ['How we use information', [
            'Information is used to fulfil orders, process payments, provide support, prevent fraud, improve our services, and send marketing where permission has been given.',
          ]],
          ['Cookies', [
            'Essential cookies operate the website and checkout. Analytics and preference cookies help us understand use and remember choices. Browser settings can be used to limit non-essential cookies.',
          ]],
          ['Sharing and retention', [
            'We share information only with service providers required for payments, fulfilment, delivery, analytics, and legal compliance. Records are retained only as long as necessary.',
          ]],
          ['Your choices', [
            'You may request access, correction, deletion, or restriction of eligible personal information and may unsubscribe from marketing at any time.',
          ]],
          ['Contact', [
            'For privacy questions or requests, contact The Purple Panther customer care team and include "Privacy Request" in the subject line.',
          ]],
        ],
      },
    ],
  },

  affiliates: {
    title: 'Affiliates',
    blocks: [
      {
        type: 'lead',
        text: 'Partner with The Purple Panther and share thoughtful dressing with your community.',
      },
      {
        type: 'benefits',
        items: [
          ['Curated partnership', 'Campaign direction and product stories aligned with your audience.'],
          ['Commission', 'Earn commission on qualifying purchases made through your unique link.'],
          ['Early access', 'Preview selected launches, editorial stories, and seasonal collections.'],
        ],
      },
      {
        type: 'form',
        id: 'affiliateForm',
        submitLabel: 'Apply now',
        rows: [
          [
            { label: 'Full name', name: 'name', required: true },
            { label: 'Email address', name: 'email', type: 'email', required: true },
          ],
          [
            { label: 'Primary platform', name: 'platform', required: true },
            { label: 'Profile or website URL', name: 'url', type: 'url', required: true },
          ],
        ],
        fields: [
          { label: 'Tell us about your audience', name: 'audience', control: 'textarea', rows: 5, required: true },
        ],
      },
    ],
  },
}

export const DEFAULT_SUPPORT_PAGE = 'faqs'
