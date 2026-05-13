// We don't have a full DOM to test bubblingMouseEvents, but I know from Leaflet docs:
// bubblingMouseEvents: When true, a mouse event on this path will trigger the same event on the map (unless L.DomEvent.stopPropagation is used). Default: true.
console.log("bubblingMouseEvents is the Leaflet way to prevent map clicks on polygons.");
