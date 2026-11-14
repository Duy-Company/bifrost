from pathlib import Path
path = Path('vendor/uxplay/renderers/video_renderer.c')
source = path.read_text()
needle = 'GstElement *make_video_sink(const char *videosink, const char *videosink_options) {\n'
patch = '''    /* Bifrost: allow a complete sink bin for playbin as well as screen mirroring. */
    if (strchr(videosink_options, '!')) {
        gchar *description = g_strconcat(videosink, videosink_options, NULL);
        GError *error = NULL;
        GstElement *bin = gst_parse_bin_from_description(description, TRUE, &error);
        g_free(description);
        if (error) { g_error_free(error); if (bin) gst_object_unref(bin); return NULL; }
        return bin;
    }
'''
if 'Bifrost: allow a complete sink bin' not in source:
    if needle not in source: raise SystemExit('Unexpected upstream make_video_sink signature')
    path.write_text(source.replace(needle, needle + patch))
