/**
 * Customer-care copy.
 *
 * These pages were static Blade templates in Laravel — the `pages` table was never read by
 * the storefront (audit R11). Keeping the copy here preserves that: it stays in version
 * control and under review, rather than silently becoming CMS content.
 *
 * The slugs match the server's allow-list in constants/cms.js. Anything not listed here
 * still renders its title and the contact form.
 */
const SUPPORT_CONTENT = {
  shipping: {
    intro: 'We deliver across India. Orders are dispatched from our studio within 1–2 business days.',
    sections: [
      {
        heading: 'Delivery charges',
        body: [
          'Delivery is free on orders above the current free-shipping threshold, which is shown in your cart and at checkout. Below that, a flat delivery rate applies.',
          'The exact amount is always calculated on your cart before you pay, after any discount has been applied.',
        ],
      },
      {
        heading: 'Delivery times',
        list: [
          'Metro cities: 3–5 business days',
          'Rest of India: 5–8 business days',
          'Remote pincodes may take slightly longer',
        ],
      },
      {
        heading: 'Tracking',
        body: [
          'You will receive an email each time your order changes status, and an expected delivery date once it ships. You can also see live status under Account → Orders.',
        ],
      },
    ],
  },

  returns: {
    intro: 'If something is not right, we will put it right.',
    sections: [
      {
        heading: 'Our policy',
        body: [
          'Unused items in their original condition and packaging can be returned within 7 days of delivery.',
          'Items that have been worn, washed or altered cannot be returned unless they arrived faulty.',
        ],
      },
      {
        heading: 'Exchanges',
        body: [
          'Size exchanges are subject to availability. If your size is out of stock we will process a refund instead.',
        ],
      },
      {
        heading: 'Refunds',
        body: [
          'Refunds are issued to the original payment method once we have received and inspected the item, usually within 5–7 business days.',
        ],
      },
    ],
  },

  'start-return': {
    intro: 'To start a return, send us your order number and the reason for the return using the form below.',
    sections: [
      {
        heading: 'What you will need',
        list: [
          'Your order number (it begins with ORD)',
          'The item or items you would like to return',
          'A short note on the reason',
        ],
      },
      {
        heading: 'What happens next',
        body: [
          'We will confirm your return by email within one business day and arrange collection where a pickup service is available in your area.',
        ],
      },
    ],
  },

  international: {
    intro: 'We currently ship within India only.',
    sections: [
      {
        heading: 'Ordering from outside India',
        body: [
          'Checkout accepts Indian delivery addresses only at this time. If you would like to be told when international delivery becomes available, drop us a note below.',
        ],
      },
    ],
  },

  'size-guide': {
    intro: 'Measurements are in inches and describe the garment, not the body.',
    sections: [
      {
        heading: 'How to measure',
        list: [
          'Bust: measure across the fullest part, keeping the tape level',
          'Waist: measure at the narrowest point',
          'Hip: measure across the fullest part',
          'Length: measure from the shoulder seam down',
        ],
      },
      {
        heading: 'Between sizes?',
        body: [
          'Where a product sits between two sizes we recommend the larger, particularly for structured pieces. Individual products may carry their own size guide on the product page.',
        ],
      },
    ],
  },

  faqs: {
    intro: 'Answers to the questions we are asked most often.',
    faqs: [
      {
        q: 'How long will my order take?',
        a: 'Orders are dispatched within 1–2 business days and typically arrive within 3–8 business days depending on your location.',
      },
      {
        q: 'Can I change or cancel my order?',
        a: 'Get in touch as soon as possible using the form below. We can usually amend an order until it has been packed.',
      },
      {
        q: 'Do you offer exchanges?',
        a: 'Yes, within 7 days of delivery and subject to availability. See Returns & Exchanges for the full policy.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept cards, UPI, net banking and wallets through Razorpay. Your card details are handled by Razorpay and never reach our servers.',
      },
      {
        q: 'How do I use a coupon?',
        a: 'Enter the code in your cart before checking out. The discount and any change to delivery charges are applied immediately so you can see the final total before you pay.',
      },
      {
        q: 'I did not receive my order confirmation.',
        a: 'Check your spam folder first. If it is not there, contact us with your order number and we will resend it.',
      },
    ],
  },

  terms: {
    intro: 'These terms govern your use of this website and any order you place through it.',
    sections: [
      {
        heading: 'Orders',
        body: [
          'An order is confirmed only once payment has been received and verified. We reserve the right to decline an order where an item is unavailable or where pricing is shown in error.',
        ],
      },
      {
        heading: 'Pricing',
        body: [
          'All prices are in Indian Rupees and include applicable taxes unless stated otherwise. Delivery charges are shown separately at checkout.',
        ],
      },
      {
        heading: 'Intellectual property',
        body: [
          'All content on this site, including images, text and designs, belongs to The Purple Panther and may not be reproduced without permission.',
        ],
      },
    ],
  },

  privacy: {
    intro: 'We collect only what we need to fulfil your order and improve your experience.',
    sections: [
      {
        heading: 'What we collect',
        list: [
          'Contact and delivery details you provide at checkout',
          'Your order history',
          'Basic analytics about how the site is used',
        ],
      },
      {
        heading: 'Payments',
        body: [
          'Payments are processed by Razorpay. We never see or store your full card details.',
        ],
      },
      {
        heading: 'Cookies',
        body: [
          'We use cookies to keep you signed in and to remember your cart. These are essential to the site working correctly.',
        ],
      },
      {
        heading: 'Your choices',
        body: [
          'You can update your details or marketing preferences at any time under Account → Account Information, or ask us to delete your data using the form below.',
        ],
      },
    ],
  },

  affiliates: {
    intro: 'Interested in working with us?',
    sections: [
      {
        heading: 'Partnerships',
        body: [
          'We work with a small number of creators and partners. If you would like to collaborate, tell us a little about yourself and your audience using the form below.',
        ],
      },
    ],
  },
}

export default SUPPORT_CONTENT
