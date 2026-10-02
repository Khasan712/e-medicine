import segno


def qr_svg(url):
    # omitsize: a viewBox instead of a fixed width/height, so the code scales to its box
    return segno.make(url, error='m').svg_inline(border=2, dark='#0f172a', light='#ffffff', omitsize=True)
