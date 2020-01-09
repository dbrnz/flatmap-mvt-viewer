import { MapManager } from './flatmap-viewer';

function errorHandler(msg)
{
    console.log(msg);
    alert(msg);
}

window.onload = function()
{
    const mapManager = new MapManager();


    mapManager.loadMap('demo', 'map1', { annotatable: true, debug: true })
        .catch(error => errorHandler(error));
};
