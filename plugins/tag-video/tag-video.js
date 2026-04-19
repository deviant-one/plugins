(function () {
    'use strict'

    let controller = null
    const delay = ms => new Promise(res => setTimeout(res, ms))
    const tagImgSelector = ".detail-header-image > img:not([placeholder]), .tag-card-header > img:not([placeholder])"
    const bgImgSelector = ".background-image-container > img:not([placeholder])"

    const replaceAll = () => wfke(tagImgSelector, () => {
        if (window.location.pathname.startsWith("/studios/")) return
        document.querySelectorAll(tagImgSelector)
            .forEach(img => replace(img, true))
        document.querySelectorAll(bgImgSelector)
            .forEach(replace)
    })

    const intervalReplaceAll = () => setInterval(replaceAll, 500)

    async function playVideo(evt) {
        const video = evt.target
        // abort controller
        if (controller) controller.abort()
        controller = new AbortController()
        const signal = controller.signal
        try {
            await delay(500)
            if (!video.matches(":hover") || signal.aborted) {
                video.muted = true
                return
            }
            const keepMuted = forbiddenConfig.getPluginSetting("tag-video", "keepMuted", false)
            await video.play()
            video.muted = keepMuted
            video.currentTime = 0
        } catch {
            // catch abort error, do nothing
        }
    }

    const stopVideo = (evt) => {
        if (controller) {
            controller.abort()
            controller = null
        }
        evt.target.muted = true
    }

    function replace(img, hover = false) {
        const src = img.getAttribute("src")
        const video = document.createElement("video")
        const propName = ["autoplay", "muted", "loop", "playsInline", "disableRemotePlayback"]
        propName.forEach(prop => video[prop] = true)
        video.attributes.alt = img.attributes.alt
        video.classList = img.classList
        video.classList.add("tag-video")
        video.src = src
        video.poster = "/plugin/tag-video/assets/loading.svg"
        if (hover) {
            video.addEventListener('mouseover', playVideo)
            video.addEventListener('mouseout', stopVideo)
        }
        // hide image for tag-cropper
        img.setAttribute("placeholder", "")
        img.style.display = "none"
        img.before(video)
        // add error handling
        video.onerror = () => {
            // replace with img
            img.style.removeProperty("display")
            video.remove()
        }
    }
    const pathSwitcher = (path) => {
        if (path == "/tags") replaceAll()
        else if (path.startsWith("/tags")) intervalReplaceAll()
        else if (path.startsWith("/scenes/")) intervalReplaceAll()
        else if (path.startsWith("/studios")) return
    }
    PluginApi.Event.addEventListener("stash:location", (e) => pathSwitcher(e.detail.data.location.pathname))
    // gql findTag listener
    pathSwitcher(window.location.pathname)
    replaceAll()
    document.addEventListener("visibilitychange", () => {
        const allVideos = document.querySelectorAll(".tag-video")
        if (document.hidden) {
            allVideos.forEach(video => video.muted = true)
            // setTimeout to auto-stop videos after 2s of hidden
            setTimeout(() => { if (document.hidden) allVideos.forEach(video => video.pause()) }, 2000)
        } else {
            allVideos.forEach(video => {
                const startInt = Math.floor(Math.random() * 200 * allVideos.length)
                setTimeout(() => video.play(), startInt)
            })
        }
    })
})()