import { readDataFile } from "./BabyGruUtils"
import { readMapFromArrayBuffer, mapToMapGrid } from '../WebGL/mgWebGLReadMap';

export function BabyGruMap(commandCentre) {
    this.type = 'map'
    this.commandCentre = commandCentre
    this.contourLevel = 0.5
    this.mapRadius = 13
    this.mapColour = [0.3, 0.3, 1.0, 1.0]
    this.liveUpdatingMaps = {}
    this.webMGContour = false
    this.cootContour = true
    this.displayObjects = { Coot: [] }
    this.litLines = true
    this.isDifference = false
}

BabyGruMap.prototype.delete = async function (glRef) {
    const $this = this
    Object.getOwnPropertyNames(this.displayObjects).forEach(displayObject => {
        if(this.displayObjects[displayObject].length > 0) {this.clearBuffersOfStyle(glRef, displayObject)}
    })
    glRef.current.drawScene()
    const inputData = {message:"delete", molNo:$this.molNo}
    const response = await $this.commandCentre.current.postMessage(inputData)
    return response
}


BabyGruMap.prototype.loadToCootFromMtzURL = function (url, name, selectedColumns) {
    const $this = this
    console.log('Off to fetch url', url)
    //Remember to change this to an appropriate URL for downloads in produciton, and to deal with the consequent CORS headache
    return fetch(url)
        .then(response => {
            return response.blob()
        }).then(reflectionData => reflectionData.arrayBuffer())
        .then(arrayBuffer => {
            return $this.loadToCootFromMtzData(new Uint8Array(arrayBuffer), name, selectedColumns)
        })
        .catch((err) => { 
            console.log(err)
            return Promise.reject(err)
         })
}

BabyGruMap.prototype.loadToCootFromMtzData = function (data, name, selectedColumns) {
    const $this = this
    $this.name = name
    return new Promise((resolve, reject) => {
        return this.commandCentre.current.cootCommand({
            returnType: "status",
            command: "shim_read_mtz",
            commandArgs: [data, name, selectedColumns]
        })
            .then(reply => {
                if (reply.data.result.status === 'Exception') {
                    reject(reply.data.result.consoleMessage)
                }
                $this.molNo = reply.data.result.result
                if (Object.keys(selectedColumns).includes('isDifference')){
                    $this.isDifference = selectedColumns.isDifference
                }
                resolve($this)
            })        
            .catch((err) => {
                return Promise.reject(err)
            })
    
    })
}

BabyGruMap.prototype.loadToCootFromMtzFile = function (source, selectedColumns) {
    const $this = this
    return readDataFile(source)
        .then(reflectionData => {
            const asUIntArray = new Uint8Array(reflectionData)
            return $this.loadToCootFromMtzData(asUIntArray, source.name, selectedColumns)
        })
}

BabyGruMap.prototype.loadToCootFromMapURL = function (url, name, isDiffMap=false) {
    const $this = this
    console.log('Off to fetch url', url)

    return fetch(url)
        .then(response => {
            return response.blob()
        }).then(mapData => mapData.arrayBuffer())
        .then(arrayBuffer => {
            return $this.loadToCootFromMapData(new Uint8Array(arrayBuffer), name, isDiffMap)
        })
        .catch((err) => { 
            return Promise.reject(err)
         })
}

BabyGruMap.prototype.loadToCootFromMapData = function (data, name, isDiffMap) {
    const $this = this
    $this.name = name
    return new Promise((resolve, reject) => {
        return this.commandCentre.current.cootCommand({
            returnType: "status",
            command: "shim_read_ccp4_map",
            commandArgs: [data, name, isDiffMap]
        })
            .then(reply => {
                if (reply.data.result?.status === 'Exception') {
                    reject(reply.data.result.consoleMessage)
                }
                $this.molNo = reply.data.result.result
                $this.isDifference = isDiffMap
                resolve($this)
            })
            .catch((err) => { 
                return Promise.reject(err)
             })    
    })
}

BabyGruMap.prototype.loadToCootFromMapFile = async function (source, isDiffMap) {
    const $this = this
    return readDataFile(source)
        .then(mapData => {
            const asUIntArray = new Uint8Array(mapData)
            return $this.loadToCootFromMapData(asUIntArray, source.name, isDiffMap)
        })
}

BabyGruMap.prototype.getMap = function () {
    const $this = this
    return this.commandCentre.current.postMessage({
        message: 'get_map',
        molNo: $this.molNo
    })
}

BabyGruMap.prototype.makeWebMGLive = function (glRef) {
    const $this = this
    $this.webMGContour = true
    let promise
    if (!Object.keys($this.liveUpdatingMaps).includes("WebMG")){
        promise = $this.contour(glRef)
    }
    else {
        promise = Promise.resolve(true)
    }
    promise.then(()=>{
        if (!glRef.current.liveUpdatingMaps.includes($this.liveUpdatingMaps['WebMG'])) {
            glRef.current.liveUpdatingMaps.push($this.liveUpdatingMaps['WebMG'])
        }
        glRef.current.reContourMaps()
        glRef.current.drawScene()
    })

}

BabyGruMap.prototype.makeWebMGUnlive = function (glRef) {
    const $this = this
    $this.webMGContour = false
    glRef.current.liveUpdatingMaps = glRef.current.liveUpdatingMaps.filter(item => item !== $this.liveUpdatingMaps['WebMG'])
    $this.liveUpdatingMaps['WebMG'].theseBuffers.forEach(buffer => {
        buffer.clearBuffers()
    })
    glRef.current.reContourMaps()
    glRef.current.drawScene()
}

BabyGruMap.prototype.makeCootLive = function (glRef, mapRadius) {
    const $this = this
    $this.mapRadius = mapRadius
    $this.cootContour = true
    $this.doCootContour(glRef,
        -glRef.current.origin[0],
        -glRef.current.origin[1],
        -glRef.current.origin[2],
        $this.mapRadius, $this.contourLevel)
    glRef.current.drawScene()
}

BabyGruMap.prototype.makeCootUnlive = function (glRef) {
    const $this = this
    $this.cootContour = false
    $this.clearBuffersOfStyle(glRef, 'Coot')
    glRef.current.buildBuffers();
    glRef.current.drawScene();
}


BabyGruMap.prototype.contour = function (glRef) {
    const $this = this
    $this.getMap()
        .then(reply => {
            let map = readMapFromArrayBuffer(reply.data.result.mapData);
            var mapGrid = mapToMapGrid(map);
            var mapTriangleData = { "mapGrids": [mapGrid], "col_tri": [[]], "norm_tri": [[]], "vert_tri": [[]], "idx_tri": [[]], "prim_types": [[]] };
            glRef.current.appendOtherData(mapTriangleData);
            var newMap = glRef.current.liveUpdatingMaps[glRef.current.liveUpdatingMaps.length - 1]

            newMap.contourLevel = $this.contourLevel
            newMap.mapColour = $this.mapColour
            $this.liveUpdatingMaps['WebMG'] = newMap

            if (!$this.webMGContour) {
                glRef.current.liveUpdatingMaps = glRef.current.liveUpdatingMaps.filter(item => item !== newMap)
            }
            else {
                glRef.current.reContourMaps()
            }

            glRef.current.drawScene()
        })
}

BabyGruMap.prototype.clearBuffersOfStyle = function (glRef, style) {
    const $this = this
    //console.log('In clear buffers', style, $this.displayObjects)
    //Empty existing buffers of this type
    $this.displayObjects[style].forEach((buffer) => {
        buffer.clearBuffers()
        glRef.current.displayBuffers = glRef.current.displayBuffers?.filter(glBuffer => glBuffer.id !== buffer.id)
    })
    $this.displayObjects[style] = []
}

BabyGruMap.prototype.doCootContour = function (glRef, x, y, z, radius, contourLevel) {

    const $this = this
    $this.mapRadius = radius

    let returnType =  "lines_mesh"
    if(this.litLines)
        returnType =  "lit_lines_mesh"

    return new Promise((resolve, reject) => {
        this.commandCentre.current.cootCommand( {
            returnType: returnType,
            command: "get_map_contours_mesh",
            commandArgs: [$this.molNo, x, y, z, radius, contourLevel]
        }).then(response => {
            const objects = [response.data.result.result]
            $this.clearBuffersOfStyle(glRef, "Coot")
            //$this.displayObjects['Coot'] = [...$this.displayObjects['Coot'], ...objects.map(object=>gl.appendOtherData(object, true))]
            objects.forEach(object => {
                var a = glRef.current.appendOtherData(object, true);
                $this.displayObjects['Coot'] = $this.displayObjects['Coot'].concat(a)
            })
            glRef.current.buildBuffers();
            glRef.current.drawScene();
            resolve(true)
        })
    })

}

BabyGruMap.prototype.associateToReflectionData = async function (selectedColumns, reflectionData) {
    if (!selectedColumns.Fobs || !selectedColumns.SigFobs || !selectedColumns.FreeR) {
        return Promise.reject('Missing column data')
    }
    let commandArgs = [
        this.molNo, { name: this.name, data: reflectionData },
        selectedColumns.Fobs, selectedColumns.SigFobs, selectedColumns.FreeR
    ]

    let result = await this.commandCentre.current.cootCommand({
        command: 'shim_associate_data_mtz_file_with_map',
        commandArgs: commandArgs,
        returnType: 'status'
    }, true)

    return result
}

