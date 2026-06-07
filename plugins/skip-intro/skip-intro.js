// hook into video element for skipping intro (seek forward)
const hookVideo = (endTime) => wfke("video-js>video", (video) => {
  const seekVideo = (e) => {
    const startTime = video.currentTime; // freeze time for evaluation
    if (startTime == 0) video.currentTime = endTime;
    else if (startTime > endTime) return; // don't skip if already past
    else if (startTime < endTime) video.currentTime = endTime; // skip to end of intro
  };
  video.addEventListener("playing", seekVideo, { once: true });
  video.addEventListener("play", seekVideo, { once: true });
  // only fire events once per video
});

// hook into video element for skipping outro (advance to next scene)
const hookVideoNext = (skipNextTime) => wfke("video-js>video", (video) => {
  const checkTime = () => {
    if (video.currentTime >= skipNextTime) {
      video.removeEventListener("timeupdate", checkTime);
      document.querySelector('.vjs-skip-button')?.click();
    }
  };
  video.addEventListener("timeupdate", checkTime);
});

// utils
const get_skip_first = (obj) => obj?.custom_fields?.["skip_first"]; // for consistent custom_field name
const get_skip_next = (obj) => obj?.custom_fields?.["skip_next"];
const get_stashdb_id = (stashids) => stashids?.find(id => id.endpoint === "https://stashdb.org/graphql")?.stash_id

// get skip_first and skip_next custom fields from studio hierarchy
const getStudioSkip = id => csLib.callGQL({
  query: `query ($id: ID!) {
  findStudio(id: $id) {
    custom_fields
    stash_ids { stash_id endpoint }
    parent_studio {
      custom_fields
      stash_ids { stash_id endpoint }
    }
  }}`,
  variables: { id }
}).then(data => {
  const studio = data.findStudio;
  const parent = studio?.parent_studio;
  const skip_first = get_skip_first(studio) ?? get_skip_first(parent);
  const skip_next = get_skip_next(studio) ?? get_skip_next(parent);
  const remote = !skip_first
    ? getRemoteStudioSkip(studio.stash_ids, parent?.stash_ids)
    : Promise.resolve(undefined);
  return { skip_first, skip_next, remote };
})

const getRemoteSkipTime = async (id) => fetch(`https://skips.feederbox.cc/api/time/${id}`)
  .then(res => res.json())
  .then(data => data.skip_seconds)
  .catch(() => undefined) // if error/ 404, return undefined

const getRemoteStudioSkip = async (stashids, parent_stashids) => {
  const stashid = get_stashdb_id(stashids);
  const parent_stashid = get_stashdb_id(parent_stashids);
  console.log("[skip-intro] fetching from remote", { stashid, parent_stashid });
  return stashid ? await getRemoteSkipTime(stashid)
    : parent_stashid ? await getRemoteSkipTime(parent_stashid)
      : null
}

// ready on page reloads
async function readyPage(event) {
  // intercept GQL request
  const findScene = event.detail?.data?.findScene
  if (!findScene) return; // only trigger on findScene

  const scene_skip_first = get_skip_first(findScene);
  const scene_skip_next = get_skip_next(findScene);

  const studioSkips = await getStudioSkip(findScene.studio?.id);
  const skip_first = scene_skip_first ?? studioSkips.skip_first ?? await studioSkips.remote;
  const skip_next = scene_skip_next ?? studioSkips.skip_next;

  if (skip_first) {
    console.log("[skip-intro] skip_first:", skip_first);
    hookVideo(skip_first);
  }
  if (skip_next) {
    console.log("[skip-intro] skip_next:", skip_next);
    hookVideoNext(skip_next);
  }
}

fbox826.gqlListener.addEventListener("response", readyPage);
