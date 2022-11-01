import { NavDropdown, Form, Button, InputGroup, Modal, FormSelect, Col, Row, Overlay, Card } from "react-bootstrap";
import { BabyGruMolecule } from "./BabyGruMolecule";
import { BabyGruMap } from "./BabyGruMap";
import { useEffect, useState, useRef, createRef } from "react";
import { BabyGruMtzWrapper } from '../BabyGruUtils';

export const BabyGruFileMenu = (props) => {

    const { molecules, setMolecules, maps, setMaps, commandCentre, glRef } = props;
    const [disambiguateColumnsVisible, setDisambiguateColumnsVisible] = useState(false)
    const [disambiguateColumnsResolve, setDisambiguateColumnsResolve] = useState(() => { })
    const [columns, setColumns] = useState({})
    const target = useRef(null);

    const awaitingPromiseRef = useRef({
        resolve: () => { },
        reject: () => { }
    })

    const loadPdbFiles = async (files) => {
        let readPromises = []
        for (const file of files) {
            readPromises.push(readPdbFile(file))
        }
        let newMolecules = await Promise.all(readPromises)

        let drawPromises = []
        for (const newMolecule of newMolecules) {
            drawPromises.push(newMolecule.fetchIfDirtyAndDraw('bonds', glRef, true))
        }
        await Promise.all(drawPromises)

        setMolecules(molecules.concat(newMolecules))
        newMolecules.at(-1).centreOn(glRef)
    }

    const readPdbFile = (file) => {
        const newMolecule = new BabyGruMolecule(commandCentre)
        return newMolecule.loadToCootFromFile(file)
    }

    const loadMtzFiles = async (files) => {
        let readPromises = []
        for (const file of files) {
            readPromises.push(readMtzFile(file))
        }
        let newMaps = await Promise.all(readPromises)
        setMaps(maps.concat(newMaps))
        props.setActiveMap(newMaps.at(-1))
    }

    const disambiguateColumns = async (newColumns) => {
        return new Promise((resolve, reject) => {
            awaitingPromiseRef.current = { resolve, reject };
            setDisambiguateColumnsVisible(true)
            setDisambiguateColumnsResolve(awaitingPromiseRef)
            const fColumns = Object.keys(newColumns)
                .filter(key => newColumns[key] === 'F')
            const pColumns = Object.keys(newColumns)
                .filter(key => newColumns[key] === 'P')
            if (fColumns.length === 1 && fColumns.includes('FWT') &&
                pColumns.length === 1 && pColumns.includes('PHWT')) {
                resolve({ F: 'FWT', PHI: 'PHWT' })
            }
            else {
                setColumns(newColumns)
            }
        })
    }

    const readMtzFile = async (file) => {
        const newMap = new BabyGruMap(commandCentre)
        const babyGruMtzWrapper = new BabyGruMtzWrapper()
        const newColumns = await babyGruMtzWrapper.loadHeaderFromFile(file)
        setDisambiguateColumnsVisible(true)
        const selectedColumns = await disambiguateColumns(newColumns)
        setDisambiguateColumnsVisible(false)
        return newMap.loadToCootFromFile(file, selectedColumns)
    }

    const fetchFileFromEBI = (pdbCode) => {
        return fetchFileFromURL(`/download/${pdbCode}.cif`, pdbCode)
    }

    const fetchFileFromURL = (url, molName) => {
        const newMolecule = new BabyGruMolecule(commandCentre)
        return newMolecule.loadToCootFromURL(url, molName)
            .then(result => {
                newMolecule.fetchIfDirtyAndDraw('bonds', glRef, true)
            }).then(result => {
                setMolecules([...molecules, newMolecule])
                return Promise.resolve(newMolecule)
            }).then(_ => {
                newMolecule.centreOn(glRef)
            })
    }

    const loadTutorialData = () => {
        const newMolecule = new BabyGruMolecule(commandCentre)
        const newMap = new BabyGruMap(commandCentre)
        newMolecule.loadToCootFromURL(`./tutorials/moorhen-tutorial-structure-number-1.pdb`, "moorhen-tutorial-1")
            .then(result => {
                newMolecule.fetchIfDirtyAndDraw('bonds', glRef, true)
            }).then(result => {
                setMolecules([...molecules, newMolecule])
                Promise.resolve(newMolecule)
            }).then(_ => {
                newMolecule.centreOn(glRef)
            }).then(_ => {
                return newMap.loadToCootFromURL(`./tutorials/moorhen-tutorial-map-number-1.mtz`, "moorhen-tutorial-1",
                    { F: "FWT", PHI: "PHWT" })
            })
            .then(result => {
                setMaps([...maps, newMap])
                props.setActiveMap(newMap)
                //newMap.cootContourInPlace(glRef.current, 15)
            })
    }

    return <>
        <NavDropdown title="File" id="basic-nav-dropdown">
            <Form.Group style={{ width: '20rem', margin: '0.5rem' }} controlId="uploadCoords" className="mb-3">
                <Form.Label>Coordinates</Form.Label>
                <Form.Control type="file" accept=".pdb, .mmcif, .ent" multiple={true} onChange={(e) => { loadPdbFiles(e.target.files) }} />
            </Form.Group>
            <Form.Group style={{ width: '20rem', margin: '0.5rem' }} controlId="downloadCoords" className="mb-3">
                <Form.Label>From PDBe</Form.Label>
                <Form.Control type="text" onKeyDown={(e) => {
                    if (e.code === 'Enter') {
                        fetchFileFromEBI(e.target.value.toUpperCase())
                    }
                }} />
            </Form.Group>
            <Form.Group style={{ width: '20rem', margin: '0.5rem' }} controlId="uploadMTZs" className="mb-3">
                <Form.Label>Map coefficients</Form.Label>
                <Form.Control ref={target} type="file" accept=".mtz" multiple={true} onChange={(e) => { loadMtzFiles(e.target.files) }} />
            </Form.Group>

            <Form.Group style={{ width: '20rem', margin: '0.5rem' }} controlId="uploadMTZs" className="mb-3">
                <Form.Label>Tutorial data</Form.Label>
                <Form.Control
                    type="button"
                    value="Load"
                    placeholder="Load"
                    aria-label="Tutorial data"
                    onClick={(e) => {
                        loadTutorialData()
                    }}
                />
            </Form.Group>

        </NavDropdown>
        <Overlay
            target={target.current}
            show={disambiguateColumnsVisible}
            placement={"right"}
        >
            {({ placement, arrowProps, show: _show, popper, ...props }) => (
                <div
                    {...props}
                    style={{
                        position: 'absolute',
                        marginBottom: '0.5rem',
                        marginLeft: '1rem',
                        backgroundColor: 'rgba(200, 200, 200, 0.65)',
                        color: 'black',
                        borderRadius: 3,
                        ...props.style,
                    }}
                >
                    <BabyGruDisambiguateColumns resolveOrReject={disambiguateColumnsResolve}
                        columns={columns} />

                </div>
            )}
        </Overlay>
    </>
}


const BabyGruDisambiguateColumns = (props) => {
    const fRef = createRef()
    const pRef = createRef()

    useEffect(() => {
    }, [props.resolveOrReject])

    return <div>
        <Card>
            <Card.Title>
                Select columns
            </Card.Title>
            <Card.Body>
                <Row key="Row1">
                    <Col key="F">
                        <FormSelect ref={fRef} defaultValue="FWT" onChange={(val) => { }}>
                            {Object.keys(props.columns)
                                .filter(key => props.columns[key] === 'F')
                                .map(key => <option value={key} key={key}>{key}</option>
                                )}
                        </FormSelect>
                    </Col>
                    <Col key="Phi">
                        <FormSelect ref={pRef} defaultValue="PHWT" onChange={(val) => { }}>
                            {Object.keys(props.columns)
                                .filter(key => props.columns[key] === 'P')
                                .map(key => <option value={key} key={key}>{key}</option>
                                )}
                        </FormSelect>
                    </Col>
                </Row>
                <Row key="Row2">
                    <Button onClick={() => {
                        props.resolveOrReject.current.resolve({
                            F: fRef.current.value,
                            PHI: pRef.current.value
                        })
                    }}>OK</Button>
                </Row>
            </Card.Body>
        </Card>
    </div>
}