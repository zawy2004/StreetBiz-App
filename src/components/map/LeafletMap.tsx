import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors } from '@/theme';

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  /** Short text inside the pin (a slot code, a price). */
  label?: string;
  /** Fill and text colours of the pin. */
  fill: string;
  ink: string;
  /** Dashed edge, for "held" (colour is never the only signal). */
  dashed?: boolean;
  selected?: boolean;
  /** `diamond`: a street feature (obstacle) rather than a slot. */
  shape?: 'pin' | 'diamond';
};

/** The base map: Esri's street map, or its satellite imagery with the place/road names over it (as on the web). */
export type MapLayer = 'street' | 'satellite';

export type MapBounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export type LeafletMapHandle = {
  flyTo: (latitude: number, longitude: number, zoom?: number) => void;
  fitMarkers: () => void;
};

type Props = {
  center: [number, number];
  zoom?: number;
  markers: MapMarker[];
  onMarkerPress?: (id: string) => void;
  /** Called after the map stops moving, with what is in view. */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** Tap on the map itself (not a pin): where, for picking a position. */
  onMapPress?: (latitude: number, longitude: number) => void;
  /** The phone's own position, drawn as a blue dot. */
  me?: { latitude: number; longitude: number } | null;
  style?: StyleProp<ViewStyle>;
  /** Fit the view to the markers whenever their set changes. */
  autoFit?: boolean;
  /** A picture of a place inside a scrolling page: no pan or zoom, touches pass to the page. */
  interactive?: boolean;
  /** Street map (default) or satellite imagery. */
  layer?: MapLayer;
};

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#m{margin:0;height:100%;background:#EEF3EF;-webkit-tap-highlight-color:transparent}
.pin{display:flex;align-items:center;justify-content:center;font:700 11px/1 -apple-system,Roboto,sans-serif;
 border-radius:10px;padding:5px 7px;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 6px rgba(17,28,43,.35);transform:translate(-50%,-50%)}
.pin.dash{border-style:dashed}
.dia{width:14px;height:14px;border:2px solid #fff;border-radius:3px;box-shadow:0 2px 6px rgba(17,28,43,.35);transform:translate(-50%,-50%) rotate(45deg)}
.pin.sel{outline:3px solid #EE5500;outline-offset:1px;transform:translate(-50%,-50%) scale(1.15);z-index:999}
.me{width:16px;height:16px;border-radius:50%;background:#0A5FA8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(10,95,168,.22);transform:translate(-50%,-50%)}
.leaflet-control-attribution{font-size:9px}
</style></head><body><div id="m"></div><script>
var post=function(o){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o))};
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([16.0607,108.2155],16);
var E='https://server.arcgisonline.com/ArcGIS/rest/services/',T='/MapServer/tile/{z}/{y}/{x}',O={maxZoom:20,maxNativeZoom:19,attribution:'Tiles &copy; Esri'};
var street=L.tileLayer(E+'World_Street_Map'+T,O).addTo(map),sat=L.layerGroup([L.tileLayer(E+'World_Imagery'+T,O),L.tileLayer(E+'Reference/World_Boundaries_and_Places'+T,O)]);
window.__layer=function(k){var on=k==='satellite';if(on){map.removeLayer(street);sat.addTo(map)}else{map.removeLayer(sat);street.addTo(map)}};
var layer=L.layerGroup().addTo(map),meLayer=L.layerGroup().addTo(map),ms=[];
function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
window.__setMarkers=function(list,fit){layer.clearLayers();ms=list;
 list.forEach(function(p){var h=p.shape==='diamond'?'<div class="dia" style="background:'+p.fill+'"></div>':'<div class="pin'+(p.dashed?' dash':'')+(p.selected?' sel':'')+'" style="background:'+p.fill+';color:'+p.ink+'">'+(p.label?esc(p.label):'&nbsp;')+'</div>';
  var mk=L.marker([p.latitude,p.longitude],{icon:L.divIcon({className:'',html:h,iconSize:null}),zIndexOffset:p.selected?1000:0}).addTo(layer);
  mk.on('click',function(e){L.DomEvent.stopPropagation(e);post({t:'marker',id:p.id})});});
 if(fit&&list.length){map.fitBounds(L.latLngBounds(list.map(function(p){return[p.latitude,p.longitude]})).pad(0.25),{maxZoom:18});}};
window.__setMe=function(p){meLayer.clearLayers();if(p)L.marker([p.latitude,p.longitude],{icon:L.divIcon({className:'',html:'<div class="me"></div>',iconSize:null}),interactive:false}).addTo(meLayer);};
window.__fly=function(a,b,z){map.flyTo([a,b],z||map.getZoom(),{duration:.5})};
window.__fit=function(){if(ms.length)map.fitBounds(L.latLngBounds(ms.map(function(p){return[p.latitude,p.longitude]})).pad(0.25),{maxZoom:18})};
window.__view=function(a,b,z){map.setView([a,b],z)};
window.__static=function(){map.dragging.disable();map.touchZoom.disable();map.doubleClickZoom.disable();map.scrollWheelZoom.disable();map.boxZoom.disable();map.keyboard.disable();if(map.tap)map.tap.disable()};
var sendB=function(){var b=map.getBounds();post({t:'bounds',minLat:b.getSouth(),maxLat:b.getNorth(),minLng:b.getWest(),maxLng:b.getEast()})};
map.on('moveend',sendB);map.on('click',function(e){post({t:'tap',lat:e.latlng.lat,lng:e.latlng.lng})});
post({t:'ready'});
</script></body></html>`;

/**
 * The map of StreetBiz (slots, stalls, positions): Leaflet with Esri street tiles (or Esri
 * imagery with names, `layer="satellite"`) in a WebView. These are the same keyless Esri layers
 * the web shows when it has no Goong maptiles key, so no map key is needed. Pins are drawn from React state; taps,
 * map moves and the view are reported back. Needs the internet for tiles.
 */
export const LeafletMap = forwardRef<LeafletMapHandle, Props>(function LeafletMap(
  { center, zoom = 16, markers, onMarkerPress, onBoundsChange, onMapPress, me, style, autoFit, interactive = true, layer = 'street' },
  ref,
) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);
  const markerJson = useMemo(() => JSON.stringify(markers), [markers]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, z) => web.current?.injectJavaScript(`window.__fly(${lat},${lng},${z ?? 'undefined'});true;`),
    fitMarkers: () => web.current?.injectJavaScript('window.__fit();true;'),
  }));

  useEffect(() => {
    if (!ready) return;
    const fit = autoFit || !fitted.current;
    fitted.current = true;
    web.current?.injectJavaScript(`window.__setMarkers(${markerJson},${fit && markers.length > 0});true;`);
  }, [ready, markerJson, autoFit, markers.length]);

  useEffect(() => {
    if (ready && !interactive) web.current?.injectJavaScript('window.__static();true;');
  }, [ready, interactive]);

  useEffect(() => {
    if (ready) web.current?.injectJavaScript(`window.__layer('${layer}');true;`);
  }, [ready, layer]);

  useEffect(() => {
    if (!ready) return;
    web.current?.injectJavaScript(`window.__setMe(${me ? JSON.stringify(me) : 'null'});true;`);
  }, [ready, me]);

  useEffect(() => {
    if (!ready || markers.length) return;
    web.current?.injectJavaScript(`window.__view(${center[0]},${center[1]},${zoom});true;`);
    // Only when there is nothing to fit: a fresh centre without pins.
  }, [ready, center, zoom, markers.length]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { t: string; id?: string; lat?: number; lng?: number } & Partial<MapBounds>;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.t === 'ready') setReady(true);
    else if (msg.t === 'marker' && msg.id) onMarkerPress?.(msg.id);
    else if (msg.t === 'tap' && msg.lat != null && msg.lng != null) onMapPress?.(msg.lat, msg.lng);
    else if (msg.t === 'bounds' && msg.minLat != null)
      onBoundsChange?.({ minLat: msg.minLat, maxLat: msg.maxLat!, minLng: msg.minLng!, maxLng: msg.maxLng! });
  };

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#EEF3EF' }, style]} pointerEvents={interactive ? 'auto' : 'none'}>
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html: HTML }}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        accessibilityLabel="Bản đồ"
      />
      {!ready ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.cta} />
        </View>
      ) : null}
    </View>
  );
});
