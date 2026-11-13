# Model Studio

A local, Famebase-style studio for an AI model (virtual influencer). It runs on your computer
and opens in your browser.

- **Models**: create a model from 1–6 reference photos. The first photo is the headshot.
- **Create Image**: new photos of the model from a description (1–4 at a time).
- **Fashion changer**: put the model in the outfit from any product or street photo.
- **Carousel**: 2–6 matching shots of one scene for a swipe post.
- **Image to Video**: animate any image into a 5 or 10 second clip.
- **Library**: every result, filterable by model and type, with download, "Animate" and "Add to post".
- **Planner**: plan posts with media, caption, platforms and time. The app reminds you when a post is
  due. It doesn't post to social accounts itself: you download the media and copy the caption.

Everything (models, results, plans) is stored in `data/` next to the app. Results are downloaded
there too, so they don't expire.

## Run it (Mac)

You need Node.js 20 or newer: `brew install node`, or the installer from nodejs.org.

```bash
cd model-studio
npm install
cp .env.example .env     # then paste your fal.ai key into .env
npm start                # open http://localhost:5173
```

Without a key the app runs in **demo mode**: every tool works, but results are placeholder cards.
This is useful for trying the app out at no cost.

## AI service: fal.ai

Generation runs on [fal.ai](https://fal.ai), pay-per-use with no subscription. Create a key at
https://fal.ai/dashboard/keys and put it in `.env` as `FAL_KEY=...`. You pay fal.ai per image or
video. Check current prices on each model's page there.

Default models (both can be changed in `.env`):

| Tools | fal.ai model | Setting |
|---|---|---|
| Create Image, Fashion changer, Carousel | `fal-ai/nano-banana/edit` (keeps the face from the reference photos) | `FAL_IMAGE_MODEL` |
| Image to Video | `fal-ai/kling-video/v2.1/standard/image-to-video` | `FAL_VIDEO_MODEL` |

A different model can need different inputs. The request is built in
`lib/providers/fal.js` (`submit`) if you swap to one with other parameters.

## How it fits together

```
server.js                 Express API + static files, job runner, resumes fal jobs after a restart
lib/store.js              JSON-file database (data/db.json) and media folder (data/media/)
lib/tools.js              the four tools: prompts and the jobs each one sends
lib/providers/fal.js      fal.ai queue API: submit, poll, fetch results
lib/providers/mock.js     demo mode: placeholder results, no network
public/                   the web app (plain HTML/CSS/JS, no build step)
```

To add another AI service, write a provider with the same `submit(job)` / `wait(handle)` shape
and choose it in `server.js`.

The server listens on `127.0.0.1` only, so it isn't reachable from other devices on your network.
