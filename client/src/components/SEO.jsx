import { Helmet } from 'react-helmet-async'

export default function SEO({
  title = 'Mohammad Khalid - Portfolio',
  description = 'Software Developer Portfolio showcasing projects, skills, and experience',
  url = '',
  image = '',
}) {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const fullUrl = url ? `${siteUrl}${url}` : siteUrl

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {fullUrl && <link rel="canonical" href={fullUrl} />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullUrl} />
      {image && <meta property="og:image" content={image.startsWith('http') ? image : `${siteUrl}${image}`} />}

      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image.startsWith('http') ? image : `${siteUrl}${image}`} />}
    </Helmet>
  )
}
