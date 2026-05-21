const Message = require('../models/Message');
const Activity = require('../models/Activity');

// Email sending (nodemailer) — kept for future use
// const nodemailer = require('nodemailer');
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

exports.send = async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  try {
    // Save to database
    await Message.create({ name, email, subject, message });

    // Log activity
    Activity.create({
      type: 'message',
      description: `New message from ${name}`,
      metadata: { name, email, subject },
    }).then(() => Activity.prune()).catch(() => {});

    // Email notification — commented out for now (uncomment when EMAIL_USER/EMAIL_PASS env vars are set)
    // await transporter.sendMail({
    //   from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
    //   to: process.env.EMAIL_USER,
    //   replyTo: email,
    //   subject: subject || `New message from ${name}`,
    //   html: `
    //     <h2>New Contact Form Submission</h2>
    //     <p><strong>Name:</strong> ${name}</p>
    //     <p><strong>Email:</strong> ${email}</p>
    //     ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
    //     <p><strong>Message:</strong></p>
    //     <p>${message.replace(/\n/g, '<br>')}</p>
    //   `,
    // });

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};
