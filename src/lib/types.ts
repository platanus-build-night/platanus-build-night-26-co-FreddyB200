export type Event = {
  id: string
  name: string
  slug: string | null
  created_at: string
}

export type Attendee = {
  id: string
  event_id: string | null
  name: string
  github: string | null
  linkedin: string | null
  building: string | null
  avatar_color: string | null
  device_token: string
  created_at: string
}

export type Photo = {
  id: string
  event_id: string | null
  storage_path: string
  uploader_id: string | null
  taken_at: string | null
  scene_description: string | null
  created_at: string
}

export type PhotoTag = {
  photo_id: string
  attendee_id: string
  created_at: string
}

/** Lo que el onboarding recolecta. El resto lo genera el sistema. */
export type OnboardInput = {
  name: string
  github: string
  linkedin: string
  building: string
}
