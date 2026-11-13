// The studio tools. Each turns a request into one or more provider jobs.
// Prompts tell the image model to keep the person from the reference photos.
const KEEP = 'Use the person in the reference photo(s) as the subject. Keep their face, skin tone, hair and body exactly the same. Photorealistic, natural lighting, high detail.';

const CAROUSEL_SHOTS = [
  'full-body wide shot, establishing the scene',
  'medium shot, natural candid pose',
  'close-up portrait, looking at the camera',
  'detail shot from a different angle, lifestyle moment',
  'over-the-shoulder or walking-away shot',
  'seated or relaxed pose, softer light',
];

export const TOOLS = {
  create_image: {
    label: 'Create Image',
    kind: 'image',
    build({ prompt, count = 1, aspect }, refs) {
      if (!prompt) throw new Error('Describe the image');
      return [{ kind: 'image', prompt: `${prompt}. ${KEEP}`, images: refs, count: clamp(count, 1, 4), aspect }];
    },
  },
  fashion_changer: {
    label: 'Fashion changer',
    kind: 'image',
    build({ prompt = '', garment, count = 1, aspect }, refs) {
      if (!garment) throw new Error('Add a photo of the outfit');
      return [{
        kind: 'image',
        prompt: `Dress the person from the first reference photo(s) in the exact outfit shown in the last image (match garment cut, colour, fabric and details). ${prompt} ${KEEP}`.trim(),
        images: [...refs.slice(0, 3), garment],
        count: clamp(count, 1, 4),
        aspect,
      }];
    },
  },
  carousel: {
    label: 'Carousel',
    kind: 'image',
    build({ prompt, slides = 4, aspect }, refs) {
      if (!prompt) throw new Error('Describe the carousel scene');
      return CAROUSEL_SHOTS.slice(0, clamp(slides, 2, 6)).map((shot) => ({
        kind: 'image',
        prompt: `${prompt}. Same outfit, location and lighting across a social media photo carousel; this slide: ${shot}. ${KEEP}`,
        images: refs,
        count: 1,
        aspect,
      }));
    },
  },
  image_to_video: {
    label: 'Image to Video',
    kind: 'video',
    build({ prompt, image, duration = 5 }) {
      if (!image) throw new Error('Pick a start image');
      return [{ kind: 'video', prompt: prompt || 'subtle natural movement, gentle camera push-in', images: [image], duration: Number(duration) >= 10 ? 10 : 5 }];
    },
  },
};

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, Number(n) || lo));
}
