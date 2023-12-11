/*
 * Copyright 2013 The Emscripten Authors.  All rights reserved.
 * Emscripten is available under two separate licenses, the MIT license and the
 * University of Illinois/NCSA Open Source License.  Both these licenses can be
 * found in the LICENSE file.
 */

#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>

#include <filesystem>
#include <complex>
#include <iostream>
#include <string>
#include <vector>
#include <random>
#include <ctime>
#include <cstdlib>
#include <fstream>

#include <math.h>
#ifndef M_PI
#define M_PI           3.14159265358979323846
#endif

#include <emscripten.h>
#include <emscripten/bind.h>

#include "geometry/residue-and-atom-specs.hh"
#include "ligand/chi-angles.hh"
#include "ligand/primitive-chi-angles.hh"
#include "ligand/rotamer.hh"
#include "api/interfaces.hh"
#include "api/molecules_container.hh"
#include "api/validation-information.hh"
#include "coot-utils/g_triangle.hh"
#include "coot-utils/vertex.hh"
#include "coot-utils/coot-map-utils.hh"

#include "mmdb_manager.h"
#include "clipper/core/ramachandran.h"
#include "clipper/clipper-ccp4.h"

#include "cartesian.h"
#include "geomutil.h"
#include "matrix.h"

#include "smilestopdb.h"

using namespace emscripten;

struct RamachandranInfo {
    std::string chainId;
    int seqNum;
    std::string insCode;
    std::string restype;
    double phi;
    double psi;
    bool isOutlier;
    bool is_pre_pro;
};

struct ResiduePropertyInfo {
    std::string chainId;
    int seqNum;
    std::string insCode;
    std::string restype;
    double property;
};

std::map<std::string,std::vector<coot::simple_rotamer> > getRotamersMap(){

    std::map<std::string,std::vector<coot::simple_rotamer> > all_rots;

    std::vector<std::string> rotamerAcids = {"VAL","PRO","SER","THR","LEU","ILE","CYS","ASP","GLU","ASN","GLN","ARG","LYS","MET","MSE","HIS","PHE","TYR","TRP"};

    coot::rotamer rot(0);

    for(unsigned ia=0;ia<rotamerAcids.size();ia++){
        std::vector<coot::simple_rotamer> rots =  rot.get_rotamers(rotamerAcids[ia], 0.001);
        all_rots[rotamerAcids[ia]] = rots;
    }

    return all_rots;
}

/*
//Next 2 are test functions.
void TakeStringIntPairVector(const std::vector<std::pair<std::string, unsigned int> > &theVec){
    for(auto el : theVec){
        std::cout << el.first << " " << el.second << std::endl;
    }
}

void TakeColourMap(const std::map<unsigned int, std::array<float, 3>> &theMap){
    for(auto el : theMap){
        std::cout << el.first << " " << el.second[0] << " " << el.second[1] << " " << el.second[2] << std::endl;
    }
}
*/

/*
*/

struct moorhen_hbond {
      int hb_hydrogen; // McDonald and Thornton H-bond algorithm

      double angle_1;  // degrees
      double angle_2;
      double angle_3;
      double dist;  // H-bond length
      bool ligand_atom_is_donor; // for use when hb_hydrogen is NULL -
                                 // no hydrogens in H-bond analysis.
      bool hydrogen_is_ligand_atom;
      bool bond_has_hydrogen_flag;

      struct moorhen_hbond_atom {
          int serial;
          double x, y, z;
          double charge, occ, b_iso;
          std::string element;
          std::string name;
          int model;
          std::string chain;
          int resNum;
          std::string residueName;
          std::string altLoc;
      };

      moorhen_hbond_atom donor;
      moorhen_hbond_atom acceptor;
      moorhen_hbond_atom donor_neigh;
      moorhen_hbond_atom acceptor_neigh;

};

coot::simple_mesh_t GenerateMoorhenMetaBalls(mmdb::Manager *molHnd, const std::string &cid_str, float gridSize, float radius, float isoLevel);
coot::instanced_mesh_t DrawSugarBlocks(mmdb::Manager *molHnd, const std::string &cid_str);
bool isSugar(const std::string &resName);

class molecules_container_js : public molecules_container_t {
    public:
        explicit molecules_container_js(bool verbose=true) : molecules_container_t(verbose) {

        }

        coot::instanced_mesh_t DrawGlycoBlocks(int imol, const std::string &cid_str) {
            mmdb::Manager *mol = get_mol(imol);
            return DrawSugarBlocks(mol,cid_str);
        }

        coot::simple_mesh_t DrawMoorhenMetaBalls(int imol, const std::string &cid_str, float gridSize, float radius, float isoLevel) {
            mmdb::Manager *mol = get_mol(imol);
            return GenerateMoorhenMetaBalls(mol,cid_str,gridSize,radius,isoLevel);
        }

        std::pair<std::string, std::string> smiles_to_pdb(const std::string &smile_cpp, const std::string &TLC, int nconf, int maxIters) {
            return SmilesToPDB(smile_cpp, TLC, nconf, maxIters);
        }

        bool model_has_glycans(int imol) {
            mmdb::Manager *mol = get_mol(imol);
            int nmodels = mol->GetNumberOfModels();
            for (int imodel=1; imodel <= nmodels; imodel++) {
                mmdb::Model *model = mol->GetModel(imodel);
                int nchains = model->GetNumberOfChains();
                for (int ichain=0; ichain < nchains; ichain++) {
                    mmdb::Chain *chain = model->GetChain(ichain);
                    int nres = chain->GetNumberOfResidues();
                    for (int ires=0; ires<nres; ires++) { 
                        mmdb::Residue *residue = chain->GetResidue(ires);
                        if (isSugar(residue->name)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        std::string generate_rand_str(const int &len) {
            const std::string charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            std::string rand_str;
            rand_str.reserve(len);
            
            std::random_device rand_dev;
            std::mt19937 gen(rand_dev());
            std::uniform_int_distribution<> distrib(0, charset.length() - 1);
    
            for (int i = 0; i < len; ++i) {
                int randomIndex = distrib(gen);
                rand_str += charset[randomIndex];
            }
            
            return rand_str;
        }

        std::string read_text_file(const std::string &file_name){
            std::string line;
            std::string file_contents;
            std::ifstream file_stream (file_name.c_str());
            
            if (file_stream.is_open()) {
                while(!file_stream.eof()) {
                    std::getline(file_stream, line);
                    file_contents += line + "\n";
                }
                file_stream.close();
            } else {
                std::cout << "Unable to open file"; 
            }
            
            return file_contents;
        }

        void write_text_file(const std::string &file_name, const std::string &file_contents) {
            std::ofstream file(file_name);
            if (file.is_open()) {
                file << file_contents;
                file.close();
            } else {
                std::cout << "Unable to open or create file '" << file_name << "' for writing." << std::endl;
            }
        }

        void remove_file(const std::string &file_name, const bool &verbose = false) {
            if (!std::filesystem::remove(file_name) && verbose) {
                std::cout << "file " << file_name << " not found!" << std::endl;
            } else if (verbose) {
                std::cout << "file " << file_name << " deleted" << std::endl;
            }
        }

        std::string get_molecule_atoms(int imol, const std::string &format) {
            std::string file_name = generate_rand_str(32);
            std::string pdb_data;  
            try {
                if (format == "pdb") {
                    file_name += ".pdb";
                    writePDBASCII(imol, file_name);
                } else if (format == "mmcif") {
                    file_name += ".mmcif";
                    writeCIFASCII(imol, file_name);
                } else {
                    std::cout << "Unrecognised format " << format << std::endl;
                    return "";
                }
                const std::string pdb_data = read_text_file(file_name);
                remove_file(file_name);
                return pdb_data;
            }
            catch(const std::filesystem::filesystem_error& err) {
                std::cout << "Error: " << err.what() << std::endl;
            }
            return "";
        }

        int read_pdb_string(const std::string &pdb_string, const std::string &molecule_name) {
            std::string file_name = generate_rand_str(32);
            if (pdb_string.find("data_") == 0) {
                file_name += ".mmcif";
            } else {
                file_name += ".pdb";
            }
            write_text_file(file_name, pdb_string);
            const int imol = molecules_container_t::read_pdb(file_name);
            remove_file(file_name);
            return imol;
        }

        int read_dictionary_string (const std::string &dictionary_string, const int &associated_imol) {
            std::string file_name = generate_rand_str(32);
            file_name += ".cif";
            write_text_file(file_name, dictionary_string);
            const int imol = molecules_container_t::import_cif_dictionary(file_name, associated_imol);
            remove_file(file_name);
            return imol;
        }

        void replace_molecule_by_model_from_string (int imol, const std::string &pdb_string) {
            std::string file_name = generate_rand_str(32);
            if (pdb_string.find("data_") == 0) {
                file_name += ".mmcif";
            } else {
                file_name += ".pdb";
            }
            write_text_file(file_name, pdb_string);
            molecules_container_t::replace_molecule_by_model_from_file(imol, file_name); 
            remove_file(file_name);
        }

        generic_3d_lines_bonds_box_t make_exportable_environment_bond_box(int imol, const std::string &chainID, int resNo,  const std::string &altLoc){
            coot::residue_spec_t resSpec(chainID,resNo,altLoc);
            return molecules_container_t::make_exportable_environment_bond_box(imol,resSpec);
        }

        std::vector<std::pair<int, int>> get_consecutive_ranges(const std::vector<int> &numbers) {
            std::vector<int> numbers_vec = numbers;
            std::sort(numbers_vec.begin(), numbers_vec.end());
            
            std::vector<std::pair<int, int>> ranges;
            if (!numbers_vec.empty()) {
                int start = numbers_vec[0];
                int end = numbers_vec[0];
                for (int i = 1; i < numbers_vec.size(); i++) {
                    int i_number = numbers_vec[i];
                    if (i_number == end + 1) {
                        end = i_number;
                    } else {
                        std::pair<int, int> i_pair(start, end);
                        ranges.push_back(i_pair);
                        start = i_number;
                        end = i_number;
                    }
                }
                std::pair<int, int> i_pair(start, end);
                ranges.push_back(i_pair);
            }
            
            return ranges;
        }

        // Returns a "||" separated string of cids.
        std::string get_neighbours_cid(int imol, const std::string &central_Cid_str, double max_dist){
            std::string neighb_cid = "";
            std::map<std::string, std::vector<int>> chainsResidues;
            mmdb::Manager *mol = get_mol(imol);
            const char * central_Cid = central_Cid_str.c_str();
            int central_SelHnd = mol->NewSelection();
            int neighb_SelHnd = mol->NewSelection();
            mol->Select(central_SelHnd, mmdb::STYPE_ATOM, central_Cid, mmdb::SKEY_NEW);
            int n_central_SelAtoms;
            mmdb::PPAtom central_SelAtom;
            mol->GetSelIndex(central_SelHnd, central_SelAtom, n_central_SelAtoms);
            mol->SelectNeighbours(neighb_SelHnd, mmdb::STYPE_RESIDUE, central_SelAtom, n_central_SelAtoms, 0.4, max_dist, mmdb::SKEY_NEW);
            int n_neighb_residues;
            mmdb::PPResidue neighb_residues;
            mol->GetSelIndex(neighb_SelHnd, neighb_residues, n_neighb_residues);
            for(int i=0; i<n_neighb_residues; i++){
                std::string chainId = std::string(neighb_residues[i]->GetChainID());
                if(!chainsResidues.count(chainId)){
                    std::vector<int> int_vec;
                    chainsResidues[chainId] = int_vec;
                }
                chainsResidues[chainId].push_back(neighb_residues[i]->GetSeqNum());
            }
            for (auto const& [key, val] : chainsResidues){
                auto residue_ranges = get_consecutive_ranges(val);
                for (int i=0; i < residue_ranges.size(); i++) {
                    auto i_residue_range = residue_ranges[i];
                    neighb_cid += std::string("//") + key + std::string("/") + std::to_string(i_residue_range.first) + "-" + std::to_string(i_residue_range.second) + std::string("/*||");
                }
            }
            neighb_cid = neighb_cid.substr(0,neighb_cid.length()-2);
            return neighb_cid;
        }

        std::pair<coot::symmetry_info_t,std::vector<std::array<float, 16>>> get_symmetry_with_matrices(int imol, float symmetry_search_radius, float x, float y, float z) { 
            coot::symmetry_info_t si = get_symmetry(imol, symmetry_search_radius, x, y, z);
            mmdb::Manager *mol = get_mol(imol);
            mmdb::Cryst *cryst = mol->GetCrystData();
            std::vector<std::array<float, 16>> matrices;
            mmdb::mat44 my_matt;
            mmdb::mat44 mol_to_origin_matt;

            for (unsigned i = 0; i < si.symm_trans.size(); i++) {

                symm_trans_t symm_trans = si.symm_trans[i].first;
                Cell_Translation cell_trans = si.symm_trans[i].second;

                cryst->GetTMatrix(mol_to_origin_matt, 0,
                              -cell_trans.us,
                              -cell_trans.vs,
                              -cell_trans.ws);

                cryst->GetTMatrix(my_matt,
                                         symm_trans.isym(),
                                         symm_trans.x(),
                                         symm_trans.y(),
                                         symm_trans.z());

                //m = mol_to_origin_matt * my_matt
                std::array<float, 16> theMat;
                int idx = 0;

                matrix mat1 = matrix(4,4);
                matrix mat2 = matrix(4,4);

                for(int j=0;j<4;j++){
                    for(int k=0;k<4;k++){
                        mat1(j,k) = my_matt[j][k];
                        mat2(j,k) = mol_to_origin_matt[j][k];
                    }
                }
                matrix mat3 = mat1 * mat2;

                for(int j=0;j<4;j++){
                    for(int k=0;k<4;k++){
                        theMat[idx] = mat3(k,j);
                        idx++;
                    }
                }

                matrices.push_back(theMat);
            }

            std::pair<coot::symmetry_info_t,std::vector<std::array<float, 16>>> thePair;
            thePair.first = si;
            thePair.second = matrices;
            return thePair;
        }

        std::vector<float> getFloats(unsigned nFloats) { 
            std::vector<float> fs;
            for(unsigned i=0;i<nFloats;i++){
                fs.push_back(i*1.0);
            }
            return fs;
        }
        int add(int ic) { 
            return ic + 1;
        }
        int writePDBASCII(int imol, const std::string &file_name) { 
            const char *fname_cp = file_name.c_str();
            return get_mol(imol)->WritePDBASCII(fname_cp);
        }
        int writeCIFASCII(int imol, const std::string &file_name) { 
            const auto mol = get_mol(imol);
            mmdb::Manager *mol_copy  = new mmdb::Manager;
            mol_copy->Copy(mol, mmdb::MMDBFCM_All);
            int ierr = mol_copy->WriteCIFASCII(file_name.c_str());
            return ierr;
        }
        int writeCCP4Map(int imol, const std::string &file_name) {
            auto xMap = (*this)[imol].xmap;
            auto clipperMap = clipper::CCP4MAPfile();
            clipperMap.open_write(file_name);
            clipperMap.export_xmap(xMap);
            return 0;
        }        
        int count_simple_mesh_vertices(const coot::simple_mesh_t &m) { return m.vertices.size(); }
        std::vector<float> go_to_blob_array(float x1, float y1, float z1, float x2, float y2, float z2, float contour_level){
            std::vector<float> o;
            std::pair<bool, clipper::Coord_orth> pp = molecules_container_t::go_to_blob(x1, y1, z1, x2, y2, z2, contour_level);
            if(pp.first){
                o.push_back(pp.second.x());
                o.push_back(pp.second.y());
                o.push_back(pp.second.z());
            }
            return o;
        }
};

std::string GetAtomNameFromAtom(mmdb::Atom *atom){
    return std::string(atom->GetAtomName());
}

std::string GetChainIDFromAtom(mmdb::Atom *atom){
    return std::string(atom->GetChainID());
}

std::string GetLabelAsymIDFromAtom(mmdb::Atom *atom){
    return std::string(atom->GetLabelAsymID());
}

std::string GetLabelCompIDFromAtom(mmdb::Atom *atom){
    return std::string(atom->GetLabelCompID());
}

std::string GetInsCodeFromAtom(mmdb::Atom *atom){
    return std::string(atom->GetInsCode());
}

std::string GetResNameFromResidue(mmdb::Residue *res){
    return std::string(res->GetResName());
}

std::string GetChainIDFromResidue(mmdb::Residue *res){
    return std::string(res->GetChainID());
}

std::string GetLabelAsymIDFromResidue(mmdb::Residue *res){
    return std::string(res->GetLabelAsymID());
}

std::string GetLabelCompIDFromResidue(mmdb::Residue *res){
    return std::string(res->GetLabelCompID());
}
 
std::string GetInsCodeFromResidue(mmdb::Residue *res){
    return std::string(res->GetInsCode());
}

EMSCRIPTEN_BINDINGS(my_module) {
    class_<clipper::Coord_orth>("Coord_orth")
    .constructor<const clipper::ftype&, const clipper::ftype&, const clipper::ftype&>()
    .function("x", &clipper::Coord_orth::x)
    .function("y", &clipper::Coord_orth::y)
    .function("z", &clipper::Coord_orth::z)
    ;
    value_object<coot::util::map_molecule_centre_info_t>("map_molecule_centre_info_t")
    .field("success", &coot::util::map_molecule_centre_info_t::success)
    .field("updated_centre", &coot::util::map_molecule_centre_info_t::updated_centre)
    .field("suggested_radius", &coot::util::map_molecule_centre_info_t::suggested_radius)
    .field("suggested_contour_level", &coot::util::map_molecule_centre_info_t::suggested_contour_level)
    ;
    class_<clipper::Cell_descr>("Cell_descr")
    .constructor<const clipper::ftype&, const clipper::ftype&, const clipper::ftype&, const clipper::ftype&, const clipper::ftype&, const clipper::ftype&>()
    .function("a", &clipper::Cell_descr::a)
    .function("b", &clipper::Cell_descr::b)
    .function("c", &clipper::Cell_descr::c)
    .function("alpha", &clipper::Cell_descr::alpha)
    .function("beta", &clipper::Cell_descr::beta)
    .function("gamma", &clipper::Cell_descr::gamma)
    .function("alpha_deg", &clipper::Cell_descr::alpha_deg)
    .function("beta_deg", &clipper::Cell_descr::beta_deg)
    .function("gamma_deg", &clipper::Cell_descr::gamma_deg)
    .function("format", &clipper::Cell_descr::format)
    ;
    class_<clipper::Cell, base<clipper::Cell_descr>>("Cell")
    .constructor()
    .constructor<const clipper::Cell_descr &>()
    .function("a_star", &clipper::Cell::a_star)
    .function("b_star", &clipper::Cell::b_star)
    .function("c_star", &clipper::Cell::c_star)
    .function("alpha_star", &clipper::Cell::alpha_star)
    .function("beta_star", &clipper::Cell::beta_star)
    .function("gamma_star", &clipper::Cell::gamma_star)
    .function("descr", &clipper::Cell::descr)
    .function("is_null", &clipper::Cell::is_null)
    .function("init", &clipper::Cell::init)
    ;
    class_<clipper::Xmap_base>("Xmap_base")
    .function("cell", &clipper::Xmap_base::cell)
    ;
    class_<clipper::String>("Clipper_String")
    .constructor()
    .constructor<const std::string>()
    ;
    class_<clipper::Xmap<float>, base<clipper::Xmap_base>>("Xmap_float")
    .constructor()
    ;
    class_<clipper::CCP4MAPfile>("CCP4MAPfile")
    .constructor()
    .function("open_read",&clipper::CCP4MAPfile::open_read)
    .function("open_write",&clipper::CCP4MAPfile::open_write)
    .function("close_read",&clipper::CCP4MAPfile::close_read)
    .function("close_write",&clipper::CCP4MAPfile::close_write)
    ;
    class_<coot::simple_rotamer>("simple_rotamer")
    .function("P_r1234",&coot::simple_rotamer::P_r1234)
    .function("Probability_rich",&coot::simple_rotamer::Probability_rich)
    .function("get_chi",&coot::simple_rotamer::get_chi)
    ;
    value_object<merge_molecule_results_info_t>("merge_molecule_results_info_t")
    .field("chain_id", &merge_molecule_results_info_t::chain_id)
    .field("spec", &merge_molecule_results_info_t::spec)
    .field("is_chain", &merge_molecule_results_info_t::is_chain)
    ;
    value_object<coot::residue_validation_information_t>("residue_validation_information_t")
    .field("function_value", &coot::residue_validation_information_t::function_value)
    .field("label", &coot::residue_validation_information_t::label)
    .field("residue_spec", &coot::residue_validation_information_t::residue_spec)
    .field("atom_spec", &coot::residue_validation_information_t::atom_spec)
    ;
    value_object<coot::chain_validation_information_t>("chain_validation_information_t")
    .field("chain_id", &coot::chain_validation_information_t::chain_id)
    .field("rviv", &coot::chain_validation_information_t::rviv)
    ;
    class_<coot::validation_information_t>("validation_information_t")
    .property("name", &coot::validation_information_t::name)
    .property("type", &coot::validation_information_t::type)
    .property("cviv", &coot::validation_information_t::cviv)
    .function("get_index_for_chain",&coot::validation_information_t::get_index_for_chain)
    .function("empty",&coot::validation_information_t::empty)
    ;
    class_<mmdb::Atom>("Atom")
    .constructor<>()
    .property("x",&mmdb::Atom::x)
    .property("y",&mmdb::Atom::y)
    .property("z",&mmdb::Atom::z)
    .property("serNum",&mmdb::Atom::serNum)
    .property("occupancy",&mmdb::Atom::occupancy)
    .property("tempFactor",&mmdb::Atom::tempFactor)
    .property("charge",&mmdb::Atom::charge)
    .property("sigX",&mmdb::Atom::sigX)
    .property("sigY",&mmdb::Atom::sigY)
    .property("sigZ",&mmdb::Atom::sigZ)
    .property("sigOcc",&mmdb::Atom::sigOcc)
    .property("sigTemp",&mmdb::Atom::sigTemp)
    .property("u11",&mmdb::Atom::u11)
    .property("u22",&mmdb::Atom::u22)
    .property("u33",&mmdb::Atom::u33)
    .property("u12",&mmdb::Atom::u12)
    .property("u13",&mmdb::Atom::u13)
    .property("u23",&mmdb::Atom::u23)
    .property("Het",&mmdb::Atom::Het)
    .property("Ter",&mmdb::Atom::Ter)
    .function("GetNBonds",&mmdb::Atom::GetNBonds)
    .function("GetModelNum",&mmdb::Atom::GetModelNum)
    .function("GetSeqNum",&mmdb::Atom::GetSeqNum)
    .function("GetLabelSeqID",&mmdb::Atom::GetLabelSeqID)
    .function("GetLabelEntityID",&mmdb::Atom::GetLabelEntityID)
    .function("GetSSEType",&mmdb::Atom::GetSSEType)
    .function("isTer",&mmdb::Atom::isTer)
    .function("isMetal",&mmdb::Atom::isMetal)
    .function("isSolvent",&mmdb::Atom::isSolvent)
    .function("isInSelection",&mmdb::Atom::isInSelection)
    .function("isNTerminus",&mmdb::Atom::isNTerminus)
    .function("isCTerminus",&mmdb::Atom::isCTerminus)
    .function("GetResidueNo",&mmdb::Atom::GetResidueNo)
    .function("GetIndex",&mmdb::Atom::GetIndex)
    .function("GetAtomName",&GetAtomNameFromAtom, allow_raw_pointers())
    .function("GetChainID",&GetChainIDFromAtom, allow_raw_pointers())
    .function("GetLabelAsymID",&GetLabelAsymIDFromAtom, allow_raw_pointers())
    .function("GetLabelCompID",&GetLabelCompIDFromAtom, allow_raw_pointers())
    .function("GetInsCode",&GetInsCodeFromAtom, allow_raw_pointers())
    ;
    class_<mmdb::Residue>("Residue")
    .constructor<>()
    .property("seqNum",&mmdb::Residue::seqNum)
    .property("label_seq_id",&mmdb::Residue::label_seq_id)
    .property("label_entity_id",&mmdb::Residue::label_entity_id)
    .property("index",&mmdb::Residue::index)
    .property("nAtoms",&mmdb::Residue::nAtoms)
    .function("GetModelNum",&mmdb::Residue::GetModelNum)
    .function("GetSeqNum",&mmdb::Residue::GetSeqNum)
    .function("GetLabelSeqID",&mmdb::Residue::GetLabelSeqID)
    .function("GetLabelEntityID",&mmdb::Residue::GetLabelEntityID)
    .function("GetResidueNo",&mmdb::Residue::GetResidueNo)
    .function("GetNofAltLocations",&mmdb::Residue::GetNofAltLocations)
    .function("isAminoacid",&mmdb::Residue::isAminoacid)
    .function("isNucleotide",&mmdb::Residue::isNucleotide)
    .function("isDNARNA",&mmdb::Residue::isDNARNA)
    .function("isSugar",&mmdb::Residue::isSugar)
    .function("isSolvent",&mmdb::Residue::isSolvent)
    .function("isModRes",&mmdb::Residue::isModRes)
    .function("isInSelection",&mmdb::Residue::isInSelection)
    .function("isNTerminus",&mmdb::Residue::isNTerminus)
    .function("isCTerminus",&mmdb::Residue::isCTerminus)
    .function("GetResName",&GetResNameFromResidue, allow_raw_pointers())
    .function("GetChainID",&GetChainIDFromResidue, allow_raw_pointers())
    .function("GetLabelAsymID",&GetLabelAsymIDFromResidue, allow_raw_pointers())
    .function("GetLabelCompID",&GetLabelCompIDFromResidue, allow_raw_pointers())
    .function("GetInsCode",&GetInsCodeFromResidue, allow_raw_pointers())
    .function("GetAtom", select_overload<mmdb::Atom*(int)>(&mmdb::Residue::GetAtom), allow_raw_pointers())
    .function("GetNumberOfAtoms", select_overload<int(void)>(&mmdb::Residue::GetNumberOfAtoms))
    .function("GetNumberOfAtoms_countTers", select_overload<int(bool)>(&mmdb::Residue::GetNumberOfAtoms))
    ;
    class_<coot::phi_psi_prob_t>("phi_psi_prob_t")
    .property("phi_psi", &coot::phi_psi_prob_t::phi_psi)
    .property("position", &coot::phi_psi_prob_t::position)
    .property("is_allowed_flag", &coot::phi_psi_prob_t::is_allowed_flag)
    .function("residue_name", &coot::phi_psi_prob_t::residue_name)// Should be function?
    .function("is_allowed", &coot::phi_psi_prob_t::is_allowed)
    ;
    class_<coot::molecule_t::moved_atom_t>("moved_atom_t")
    .constructor<const std::string&, const std::string&, float, float, float, int>()
    .property("atom_name", &coot::molecule_t::moved_atom_t::atom_name)
    .property("alt_conf", &coot::molecule_t::moved_atom_t::alt_conf)
    .property("x", &coot::molecule_t::moved_atom_t::x)
    .property("y", &coot::molecule_t::moved_atom_t::y)
    .property("z", &coot::molecule_t::moved_atom_t::z)
    .property("index", &coot::molecule_t::moved_atom_t::index)
    ;
    value_object<molecules_container_t::auto_read_mtz_info_t>("auto_read_mtz_info_t")
    .field("idx", &molecules_container_t::auto_read_mtz_info_t::idx)
    .field("F", &molecules_container_t::auto_read_mtz_info_t::F)
    .field("phi", &molecules_container_t::auto_read_mtz_info_t::phi)
    .field("w", &molecules_container_t::auto_read_mtz_info_t::w)
    .field("weights_used", &molecules_container_t::auto_read_mtz_info_t::weights_used)
    ;
    value_object<coot::molecule_t::interesting_place_t>("interesting_place_t")
    .field("feature_type", &coot::molecule_t::interesting_place_t::feature_type)
    .field("residue_spec", &coot::molecule_t::interesting_place_t::residue_spec)
    .field("button_label", &coot::molecule_t::interesting_place_t::button_label)
    .field("feature_value", &coot::molecule_t::interesting_place_t::feature_value)
    .field("badness", &coot::molecule_t::interesting_place_t::badness)
    .field("x", &coot::molecule_t::interesting_place_t::x)
    .field("y", &coot::molecule_t::interesting_place_t::y)
    .field("z", &coot::molecule_t::interesting_place_t::z)
    ;
    class_<coot::molecule_t::moved_residue_t>("moved_residue_t")
    .constructor<const std::string&, int, const std::string&>()
    .property("chain_id", &coot::molecule_t::moved_residue_t::chain_id)
    .property("res_no", &coot::molecule_t::moved_residue_t::res_no)
    .property("ins_code", &coot::molecule_t::moved_residue_t::ins_code)
    .property("moved_atoms", &coot::molecule_t::moved_residue_t::moved_atoms)
    .function("add_atom",&coot::molecule_t::moved_residue_t::add_atom)
    ;
    class_<coot::Cell>("Coot_Cell")
    .property("a", &coot::Cell::a)
    .property("b", &coot::Cell::b)
    .property("c", &coot::Cell::c)
    .property("alpha", &coot::Cell::alpha)
    .property("beta", &coot::Cell::beta)
    .property("gamma", &coot::Cell::gamma)
    ;
    value_object<coot::symmetry_info_t>("symmetry_info_t")
    .field("cell",&coot::symmetry_info_t::cell)
    .field("symm_trans",&coot::symmetry_info_t::symm_trans)
    ;
    class_<molecules_container_t>("molecules_container_t")
    .constructor<bool>()
    .function("get_ncs_related_chains", &molecules_container_t::get_ncs_related_chains)
    .function("is_EM_map",&molecules_container_t::is_EM_map)
    .function("set_map_sampling_rate",&molecules_container_t::set_map_sampling_rate)
    .function("get_mesh_for_ligand_validation_vs_dictionary",&molecules_container_t::get_mesh_for_ligand_validation_vs_dictionary)
    .function("clear_refinement",&molecules_container_t::clear_refinement)
    .function("get_suggested_initial_contour_level",&molecules_container_t::get_suggested_initial_contour_level)
    .function("clear_target_position_restraints",&molecules_container_t::clear_target_position_restraints)
    .function("add_target_position_restraint_and_refine",&molecules_container_t::add_target_position_restraint_and_refine)
    .function("refine",&molecules_container_t::refine)
    .function("init_refinement_of_molecule_as_fragment_based_on_reference",&molecules_container_t::init_refinement_of_molecule_as_fragment_based_on_reference)
    .function("copy_fragment_for_refinement_using_cid",&molecules_container_t::copy_fragment_for_refinement_using_cid)
    .function("add_target_position_restraint",&molecules_container_t::add_target_position_restraint)
    .function("get_h_bonds",&molecules_container_t::get_h_bonds)
    .function("change_to_next_rotamer",&molecules_container_t::change_to_next_rotamer)
    .function("change_to_previous_rotamer",&molecules_container_t::change_to_previous_rotamer)
    .function("change_to_first_rotamer",&molecules_container_t::change_to_first_rotamer)
    .function("set_user_defined_atom_colour_by_selection",&molecules_container_t::set_user_defined_atom_colour_by_selection)
    .function("set_user_defined_bond_colours",&molecules_container_t::set_user_defined_bond_colours)
    .function("set_colour_wheel_rotation_base",&molecules_container_t::set_colour_wheel_rotation_base)
    .function("set_base_colour_for_bonds",&molecules_container_t::set_base_colour_for_bonds)
    .function("set_use_bespoke_carbon_atom_colour",&molecules_container_t::set_use_bespoke_carbon_atom_colour)
    .function("get_symmetry",&molecules_container_t::get_symmetry)
    .function("fit_to_map_by_random_jiggle_using_cid",&molecules_container_t::fit_to_map_by_random_jiggle_using_cid)
    .function("get_active_atom",&molecules_container_t::get_active_atom)
    .function("is_a_difference_map",&molecules_container_t::is_a_difference_map)
    .function("add_hydrogen_atoms",&molecules_container_t::add_hydrogen_atoms)
    .function("delete_hydrogen_atoms",&molecules_container_t::delete_hydrogen_atoms)
    .function("get_gaussian_surface",&molecules_container_t::get_gaussian_surface)
    .function("get_monomer_from_dictionary",&molecules_container_t::get_monomer_from_dictionary)
    .function("get_molecular_representation_mesh",&molecules_container_t::get_molecular_representation_mesh)
    .function("get_map_weight",&molecules_container_t::get_map_weight)
    .function("set_map_weight",&molecules_container_t::set_map_weight)
    .function("set_show_timings",&molecules_container_t::set_show_timings)
    .function("get_molecule_name",&molecules_container_t::get_molecule_name)
    .function("non_standard_residue_types_in_model",&molecules_container_t::non_standard_residue_types_in_model)
    .function("get_map_rmsd_approx",&molecules_container_t::get_map_rmsd_approx)
    .function("set_draw_missing_residue_loops",&molecules_container_t::set_draw_missing_residue_loops)
    .function("set_make_backups",&molecules_container_t::set_make_backups)
    .function("get_chains_in_model",&molecules_container_t::get_chains_in_model)
    .function("get_residue_names_with_no_dictionary",&molecules_container_t::get_residue_names_with_no_dictionary)
    .function("write_map",&molecules_container_t::write_map)
    .function("delete_atom",&molecules_container_t::delete_atom)
    .function("delete_atom_using_cid",&molecules_container_t::delete_atom_using_cid)
    .function("delete_residue",&molecules_container_t::delete_residue)
    .function("delete_residue_using_cid",&molecules_container_t::delete_residue_using_cid)
    .function("delete_residue_atoms_with_alt_conf",&molecules_container_t::delete_residue_atoms_with_alt_conf)
    .function("delete_residue_atoms_using_cid",&molecules_container_t::delete_residue_atoms_using_cid)
    .function("delete_side_chain",&molecules_container_t::delete_side_chain)
    .function("delete_chain_using_cid",&molecules_container_t::delete_chain_using_cid)
    .function("get_molecule_centre",&molecules_container_t::get_molecule_centre)
    .function("set_refinement_is_verbose",&molecules_container_t::set_refinement_is_verbose)
    .function("set_refinement_is_verbose",&molecules_container_t::set_refinement_is_verbose)
    .function("peptide_omega_analysis",&molecules_container_t::peptide_omega_analysis)
    .function("calculate_new_rail_points",&molecules_container_t::calculate_new_rail_points)
    .function("rail_points_total",&molecules_container_t::rail_points_total)
    .function("sfcalc_genmap",&molecules_container_t::sfcalc_genmap)
    .function("sfcalc_genmaps_using_bulk_solvent",&molecules_container_t::sfcalc_genmaps_using_bulk_solvent)
    .function("add_colour_rule",&molecules_container_t::add_colour_rule)
    .function("delete_colour_rules",&molecules_container_t::delete_colour_rules)
    .function("add_colour_rules_multi",&molecules_container_t::add_colour_rules_multi)
    .function("fit_ligand_right_here",&molecules_container_t::fit_ligand_right_here)
    .function("fit_ligand",&molecules_container_t::fit_ligand)
    .function("fit_to_map_by_random_jiggle",&molecules_container_t::fit_to_map_by_random_jiggle)
    .function("fit_to_map_by_random_jiggle_using_cid",&molecules_container_t::fit_to_map_by_random_jiggle_using_cid)
    .function("get_svg_for_residue_type",&molecules_container_t::get_svg_for_residue_type)
    .function("is_valid_model_molecule",&molecules_container_t::is_valid_model_molecule)
    .function("is_valid_map_molecule",&molecules_container_t::is_valid_map_molecule)
    .function("read_pdb",&molecules_container_t::read_pdb)
    .function("read_ccp4_map",&molecules_container_t::read_ccp4_map)
    .function("read_mtz",&molecules_container_t::read_mtz)
    .function("residue_cid_to_residue_spec",&molecules_container_t::residue_cid_to_residue_spec)
    //   int import_cif_dictionary(const std::string &cif_file_name, int imol_enc);
    .function("import_cif_dictionary",&molecules_container_t::import_cif_dictionary)
    .function("density_fit_analysis",&molecules_container_t::density_fit_analysis)
    .function("get_number_of_atoms",&molecules_container_t::get_number_of_atoms)
    //Using allow_raw_pointers(). Perhaps suggests we need to do something different from exposing mmdb pointers to JS.
    .function("get_residue",&molecules_container_t::get_residue, allow_raw_pointers())
    .function("get_atom",&molecules_container_t::get_atom, allow_raw_pointers())
    .function("flipPeptide_cid",   select_overload<int(int, const std::string&,      const std::string&)>(&molecules_container_t::flip_peptide_using_cid))
    .function("flipPeptide",       select_overload<int(int, const coot::atom_spec_t&,const std::string&)>(&molecules_container_t::flip_peptide))
    .function("side_chain_180",    select_overload<int(int, const std::string&)>                         (&molecules_container_t::side_chain_180))
    .function("eigen_flip_ligand", select_overload<void(int, const std::string&)>                        (&molecules_container_t::eigen_flip_ligand_using_cid))
    .function("jed_flip",          select_overload<std::string(int, const std::string&, bool)>           (&molecules_container_t::jed_flip))
    .function("add_terminal_residue_directly_using_cid",&molecules_container_t::add_terminal_residue_directly_using_cid)
    .function("test_origin_cube",&molecules_container_t::test_origin_cube)
    .function("get_ramachandran_validation_markup_mesh",&molecules_container_t::get_ramachandran_validation_markup_mesh)
    .function("get_rotamer_dodecs",&molecules_container_t::get_rotamer_dodecs)
    .function("get_rotamer_dodecs_instanced",&molecules_container_t::get_rotamer_dodecs_instanced)
    .function("auto_fit_rotamer",&molecules_container_t::auto_fit_rotamer)
    .function("rigid_body_fit",&molecules_container_t::rigid_body_fit)
    .function("cis_trans_convert",&molecules_container_t::cis_trans_convert)
    .function("set_draw_missing_residue_loops",&molecules_container_t::set_draw_missing_residue_loops)
    .function("get_map_contours_mesh",&molecules_container_t::get_map_contours_mesh)
    .function("geometry_init_standard",&molecules_container_t::geometry_init_standard)
    .function("fill_rotamer_probability_tables",&molecules_container_t::fill_rotamer_probability_tables)
    .function("copy_fragment_using_residue_range",&molecules_container_t::copy_fragment_using_residue_range)
    .function("copy_fragment_using_cid",&molecules_container_t::copy_fragment_using_cid)
    .function("close_molecule",&molecules_container_t::close_molecule)
    .function("undo",&molecules_container_t::undo)
    .function("redo",&molecules_container_t::redo)
    .function("refine_residues_using_atom_cid",&molecules_container_t::refine_residues_using_atom_cid)
    .function("refine_residue_range",&molecules_container_t::refine_residue_range)
    .function("contact_dots_for_ligand",&molecules_container_t::contact_dots_for_ligand)
    .function("all_molecule_contact_dots",&molecules_container_t::all_molecule_contact_dots)
    .function("get_chemical_features_mesh",&molecules_container_t::get_chemical_features_mesh)
    .function("set_imol_refinement_map",&molecules_container_t::set_imol_refinement_map)
    .function("mutate",&molecules_container_t::mutate)
    .function("fill_partial_residue",&molecules_container_t::fill_partial_residue)
    .function("add_alternative_conformation",&molecules_container_t::add_alternative_conformation)
    .function("delete_using_cid",&molecules_container_t::delete_using_cid)
    .function("get_bonds_mesh",&molecules_container_t::get_bonds_mesh)
    .function("get_bonds_mesh_instanced",&molecules_container_t::get_bonds_mesh_instanced)
    .function("get_bonds_mesh_for_selection_instanced",&molecules_container_t::get_bonds_mesh_for_selection_instanced)
    .function("go_to_blob",&molecules_container_t::go_to_blob)
    .function("set_map_sampling_rate",&molecules_container_t::set_map_sampling_rate)
    .function("get_monomer",&molecules_container_t::get_monomer)
    .function("get_monomer_and_position_at",&molecules_container_t::get_monomer_and_position_at)
    .function("move_molecule_to_new_centre",&molecules_container_t::move_molecule_to_new_centre)
    .function("apply_transformation_to_atom_selection",&molecules_container_t::apply_transformation_to_atom_selection)
    .function("new_positions_for_residue_atoms",&molecules_container_t::new_positions_for_residue_atoms)
    .function("new_positions_for_atoms_in_residues",&molecules_container_t::new_positions_for_atoms_in_residues)
    //.function("get_interesting_places",&molecules_container_t::get_interesting_places)
    .function("difference_map_peaks",&molecules_container_t::difference_map_peaks)
    .function("pepflips_using_difference_map",&molecules_container_t::pepflips_using_difference_map)
    .function("add_waters",&molecules_container_t::add_waters)
    .function("ramachandran_analysis",&molecules_container_t::ramachandran_analysis)
    .function("density_correlation_analysis",&molecules_container_t::density_correlation_analysis)
    .function("rotamer_analysis",&molecules_container_t::rotamer_analysis)
    .function("associate_data_mtz_file_with_map",&molecules_container_t::associate_data_mtz_file_with_map)
    .function("connect_updating_maps",&molecules_container_t::connect_updating_maps)
    .function("residues_with_missing_atoms",&molecules_container_t::residues_with_missing_atoms)
    .function("ramachandran_validation",&molecules_container_t::ramachandran_validation)
    .function("merge_molecules", select_overload<std::pair<int, std::vector<merge_molecule_results_info_t> >(int,const std::string &)>(&molecules_container_t::merge_molecules))
    .function("get_single_letter_codes_for_chain",&molecules_container_t::get_single_letter_codes_for_chain)
    .function("get_r_factor_stats",&molecules_container_t::get_r_factor_stats)
    .function("get_colour_rules",&molecules_container_t::get_colour_rules)
    .function("mmrrcc",&molecules_container_t::mmrrcc)
    .function("auto_read_mtz",&molecules_container_t::auto_read_mtz)
    .function("SSM_superpose",&molecules_container_t::SSM_superpose)
    .function("add_to_non_drawn_bonds",&molecules_container_t::add_to_non_drawn_bonds)
    .function("clear_non_drawn_bonds",&molecules_container_t::clear_non_drawn_bonds)
    .function("file_name_to_string",&molecules_container_t::file_name_to_string)
    .function("replace_molecule_by_model_from_file",&molecules_container_t::replace_molecule_by_model_from_file)
    .function("replace_map_by_mtz_from_file",&molecules_container_t::replace_map_by_mtz_from_file)
    .function("replace_fragment",&molecules_container_t::replace_fragment)
    .function("sharpen_blur_map",&molecules_container_t::sharpen_blur_map)
    .function("flip_hand",&molecules_container_t::flip_hand)
    .function("mask_map_by_atom_selection",&molecules_container_t::mask_map_by_atom_selection)
    .function("generate_self_restraints",&molecules_container_t::generate_self_restraints)
    .function("generate_chain_self_restraints",&molecules_container_t::generate_chain_self_restraints)
    .function("generate_local_self_restraints",&molecules_container_t::generate_local_self_restraints)
    .function("clear_extra_restraints",&molecules_container_t::clear_extra_restraints)
    .function("get_extra_restraints_mesh",&molecules_container_t::get_extra_restraints_mesh)
    .function("unmodelled_blobs",&molecules_container_t::unmodelled_blobs)
    .function("get_map_molecule_centre",&molecules_container_t::get_map_molecule_centre)
    .function("get_cell",&molecules_container_t::get_cell)
    .function("get_cell",&molecules_container_t::get_cell)
    .function("make_masked_maps_split_by_chain",&molecules_container_t::make_masked_maps_split_by_chain)
    .function("fit_to_map_by_random_jiggle_with_blur_using_cid",&molecules_container_t::fit_to_map_by_random_jiggle_with_blur_using_cid)
    .function("get_map_contours_mesh_using_other_map_for_colours",&molecules_container_t::get_map_contours_mesh_using_other_map_for_colours)
    .function("set_refinement_geman_mcclure_alpha",&molecules_container_t::set_refinement_geman_mcclure_alpha)
    .function("get_geman_mcclure_alpha",&molecules_container_t::get_geman_mcclure_alpha)
    .function("get_map_histogram",&molecules_container_t::get_map_histogram)
    .function("sharpen_blur_map_with_resample",&molecules_container_t::sharpen_blur_map_with_resample)
    .function("find_water_baddies",&molecules_container_t::find_water_baddies)
    ;
    class_<molecules_container_js, base<molecules_container_t>>("molecules_container_js")
    .constructor<bool>()
    .function("writePDBASCII",&molecules_container_js::writePDBASCII)
    .function("writeCIFASCII",&molecules_container_js::writeCIFASCII)
    .function("writeCCP4Map",&molecules_container_js::writeCCP4Map)
    .function("count_simple_mesh_vertices",&molecules_container_js::count_simple_mesh_vertices)
    .function("go_to_blob_array",&molecules_container_js::go_to_blob_array)
    .function("add",&molecules_container_js::add)
    .function("getFloats",&molecules_container_js::getFloats)
    .function("get_symmetry_with_matrices",&molecules_container_js::get_symmetry_with_matrices)
    .function("get_neighbours_cid",&molecules_container_js::get_neighbours_cid)
    .function("make_exportable_environment_bond_box",&molecules_container_js::make_exportable_environment_bond_box)
    .function("DrawGlycoBlocks",&molecules_container_js::DrawGlycoBlocks)
    .function("DrawMoorhenMetaBalls",&molecules_container_js::DrawMoorhenMetaBalls)
    .function("model_has_glycans",&molecules_container_js::model_has_glycans)
    .function("get_molecule_atoms", &molecules_container_js::get_molecule_atoms)
    .function("read_pdb_string", &molecules_container_js::read_pdb_string)
    .function("smiles_to_pdb", &molecules_container_js::smiles_to_pdb)
    .function("replace_molecule_by_model_from_string", &molecules_container_js::replace_molecule_by_model_from_string)
    .function("read_dictionary_string", &molecules_container_js::read_dictionary_string)
    ;
    value_object<generic_3d_lines_bonds_box_t>("generic_3d_lines_bonds_box_t")
    .field("line_segments", &generic_3d_lines_bonds_box_t::line_segments)
    ;
    class_<coot::CartesianPair>("CartesianPair")
    .function("getStart", &coot::CartesianPair::getStart)
    .function("getFinish", &coot::CartesianPair::getFinish)
    .function("amplitude", &coot::CartesianPair::amplitude)
    ;
    class_<RamachandranInfo>("RamachandranInfo")
    .constructor<>()
    .property("chainId", &RamachandranInfo::chainId)
    .property("seqNum", &RamachandranInfo::seqNum)
    .property("insCode", &RamachandranInfo::insCode)
    .property("restype", &RamachandranInfo::restype)
    .property("phi", &RamachandranInfo::phi)
    .property("psi", &RamachandranInfo::psi)
    .property("isOutlier", &RamachandranInfo::isOutlier)
    .property("is_pre_pro", &RamachandranInfo::is_pre_pro)
    ;
    class_<ResiduePropertyInfo>("ResiduePropertyInfo")
    .constructor<>()
    .property("chainId", &ResiduePropertyInfo::chainId)
    .property("seqNum", &ResiduePropertyInfo::seqNum)
    .property("insCode", &ResiduePropertyInfo::insCode)
    .property("restype", &ResiduePropertyInfo::restype)
    .property("property", &ResiduePropertyInfo::property)
    ;
    class_<coot::instancing_data_type_A_t>("instancing_data_type_A_t")
    .property("position",&coot::instancing_data_type_A_t::position)
    .property("colour",&coot::instancing_data_type_A_t::colour)
    .property("size",&coot::instancing_data_type_A_t::size)
    ;
    class_<coot::instancing_data_type_B_t>("instancing_data_type_B_t")
    .property("position",&coot::instancing_data_type_B_t::position)
    .property("colour",&coot::instancing_data_type_B_t::colour)
    .property("size",&coot::instancing_data_type_B_t::size)
    .property("orientation",&coot::instancing_data_type_B_t::orientation)
    ;
    value_object<coot::instanced_geometry_t>("instanced_geometry_t")
    .field("vertices",&coot::instanced_geometry_t::vertices)
    .field("triangles",&coot::instanced_geometry_t::triangles)
    .field("instancing_data_A",&coot::instanced_geometry_t::instancing_data_A)
    .field("instancing_data_B",&coot::instanced_geometry_t::instancing_data_B)
    .field("name",&coot::instanced_geometry_t::name)
    ;
    value_object<coot::instanced_mesh_t>("instanced_mesh_t")
    .field("geom",&coot::instanced_mesh_t::geom)
    .field("markup",&coot::instanced_mesh_t::markup)
    ;
    value_object<coot::atom_spec_t>("atom_spec_t")
    .field("chain_id",&coot::atom_spec_t::chain_id)
    .field("res_no",&coot::atom_spec_t::res_no)
    .field("ins_code",&coot::atom_spec_t::ins_code)
    .field("atom_name",&coot::atom_spec_t::atom_name)
    .field("alt_conf",&coot::atom_spec_t::alt_conf)
    .field("int_user_data",&coot::atom_spec_t::int_user_data)
    .field("float_user_data",&coot::atom_spec_t::float_user_data)
    .field("string_user_data",&coot::atom_spec_t::string_user_data)
    .field("model_number",&coot::atom_spec_t::model_number)
    ;
    class_<coot::util::phi_psi_t>("phi_psi_t")
    .function("phi",&coot::util::phi_psi_t::phi)
    .function("psi",&coot::util::phi_psi_t::psi)
    .function("label",&coot::util::phi_psi_t::label)
    .function("residue_name",&coot::util::phi_psi_t::residue_name)
    .function("is_filled",&coot::util::phi_psi_t::is_filled)
    .function("is_pre_pro",&coot::util::phi_psi_t::is_pre_pro)
    .property("ins_code",&coot::util::phi_psi_t::ins_code)
    .property("chain_id",&coot::util::phi_psi_t::chain_id)
    .property("residue_number",&coot::util::phi_psi_t::residue_number)
    ;
    class_<coot::Cartesian>("Cartesian")
    .function("x",&coot::Cartesian::x)
    .function("y",&coot::Cartesian::y)
    .function("z",&coot::Cartesian::z)
    ;
    value_object<coot::residue_spec_t>("residue_spec_t")
    .field("model_number",&coot::residue_spec_t::model_number)
    .field("chain_id",&coot::residue_spec_t::chain_id)
    .field("res_no",&coot::residue_spec_t::res_no)
    .field("ins_code",&coot::residue_spec_t::ins_code)
    .field("int_user_data",&coot::residue_spec_t::int_user_data)
    ;
    value_object<coot::api::vnc_vertex>("vnc_vertex")
    .field("pos",&coot::api::vnc_vertex::pos)
    .field("normal",&coot::api::vnc_vertex::normal)
    .field("color",&coot::api::vnc_vertex::color)
    ;
    value_object<coot::api::vn_vertex>("vn_vertex")
    .field("pos",&coot::api::vn_vertex::pos)
    .field("normal",&coot::api::vn_vertex::normal)
    ;
    value_object<coot::molecule_t::rotamer_change_info_t>("rotamer_change_info_t")
    .field("rank", &coot::molecule_t::rotamer_change_info_t::rank)
    .field("name", &coot::molecule_t::rotamer_change_info_t::name)
    .field("richardson_probability", &coot::molecule_t::rotamer_change_info_t::richardson_probability)
    .field("status", &coot::molecule_t::rotamer_change_info_t::status)
    ;
    value_object<g_triangle>("g_triangle")
    .field("point_id", &g_triangle::point_id)
    ;
    value_object<Cell_Translation>("Cell_Translation")
    .field("us", &Cell_Translation::us)
    .field("ws", &Cell_Translation::ws)
    .field("vs", &Cell_Translation::vs)
    ;
    class_<symm_trans_t>("symm_trans_t")
    .property("symm_as_string",&symm_trans_t::symm_as_string)
    .function("is_identity",&symm_trans_t::is_identity)
    .function("add_shift",&symm_trans_t::add_shift)
    .function("isym",&symm_trans_t::isym)
    .function("x",&symm_trans_t::x)
    .function("y",&symm_trans_t::y)
    .function("z",&symm_trans_t::z)
    ;
    value_object<coot::simple_mesh_t>("simple_mesh_t")
    .field("vertices",&coot::simple_mesh_t::vertices)
    .field("triangles",&coot::simple_mesh_t::triangles)
    .field("status",&coot::simple_mesh_t::status)
    .field("name",&coot::simple_mesh_t::name)
    ;

    class_<coot::util::density_correlation_stats_info_t>("density_correlation_stats_info_t")
    .property("n",&coot::util::density_correlation_stats_info_t::n)
    .property("sum_xy",&coot::util::density_correlation_stats_info_t::sum_xy)
    .property("sum_sqrd_x",&coot::util::density_correlation_stats_info_t::sum_sqrd_x)
    .property("sum_sqrd_y",&coot::util::density_correlation_stats_info_t::sum_sqrd_y)
    .property("sum_x",&coot::util::density_correlation_stats_info_t::sum_x)
    .property("sum_x",&coot::util::density_correlation_stats_info_t::sum_x)
    .function("var_x",&coot::util::density_correlation_stats_info_t::var_x)
    .function("var_y",&coot::util::density_correlation_stats_info_t::var_y)
    .function("correlation",&coot::util::density_correlation_stats_info_t::correlation)
    ;

    value_object<superpose_results_t>("superpose_results_t")
    .field("superpose_info",     &superpose_results_t::superpose_info) // a json file (string)
    .field("alignment",          &superpose_results_t::alignment)
    .field("alignment_info_vec", &superpose_results_t::alignment_info_vec)
    .field("aligned_pairs",      &superpose_results_t::aligned_pairs)
    ;

    value_array<std::array<float, 16>>("array_native_float_16")
        .element(emscripten::index<0>())
        .element(emscripten::index<1>())
        .element(emscripten::index<2>())
        .element(emscripten::index<3>())
        .element(emscripten::index<4>())
        .element(emscripten::index<5>())
        .element(emscripten::index<6>())
        .element(emscripten::index<7>())
        .element(emscripten::index<8>())
        .element(emscripten::index<9>())
        .element(emscripten::index<10>())
        .element(emscripten::index<11>())
        .element(emscripten::index<12>())
        .element(emscripten::index<13>())
        .element(emscripten::index<14>())
        .element(emscripten::index<15>())
    ;

    value_array<std::array<float, 3>>("array_native_float_3")
        .element(emscripten::index<0>())
        .element(emscripten::index<1>())
        .element(emscripten::index<2>())
    ;

    value_object<coot::molecule_t::histogram_info_t>("histogram_info_t")
        .field("base", &coot::molecule_t::histogram_info_t::base)
        .field("bin_width", &coot::molecule_t::histogram_info_t::bin_width)
        .field("counts", &coot::molecule_t::histogram_info_t::counts)
    ;

    value_object<moorhen::h_bond>("h_bond")
        .field("hb_hydrogen",&moorhen::h_bond::hb_hydrogen)
        .field("donor",&moorhen::h_bond::donor)
        .field("acceptor",&moorhen::h_bond::acceptor)
        .field("donor_neigh",&moorhen::h_bond::donor_neigh)
        .field("acceptor_neigh",&moorhen::h_bond::acceptor_neigh)
        .field("angle_1",&moorhen::h_bond::angle_1)
        .field("angle_2",&moorhen::h_bond::angle_2)
        .field("angle_3",&moorhen::h_bond::angle_3)
        .field("dist",&moorhen::h_bond::dist)
        .field("ligand_atom_is_donor",&moorhen::h_bond::ligand_atom_is_donor)
        .field("hydrogen_is_ligand_atom",&moorhen::h_bond::hydrogen_is_ligand_atom)
        .field("bond_has_hydrogen_flag",&moorhen::h_bond::bond_has_hydrogen_flag)
    ;

    value_object<moorhen::h_bond_atom>(" h_bond_atom")
        .field("serial",&moorhen::h_bond_atom::serial)
        .field("x",&moorhen::h_bond_atom::x)
        .field("y",&moorhen::h_bond_atom::y)
        .field("z",&moorhen::h_bond_atom::z)
        .field("charge",&moorhen::h_bond_atom::charge)
        .field("occ",&moorhen::h_bond_atom::occ)
        .field("b_iso",&moorhen::h_bond_atom::b_iso)
        .field("element",&moorhen::h_bond_atom::element)
        .field("name",&moorhen::h_bond_atom::name)
        .field("model",&moorhen::h_bond_atom::model)
        .field("chain",&moorhen::h_bond_atom::chain)
        .field("res_no",&moorhen::h_bond_atom::res_no)
        .field("residue_name",&moorhen::h_bond_atom::residue_name)
        .field("altLoc",&moorhen::h_bond_atom::altLoc)
    ;

    register_vector<coot::atom_spec_t>("VectorAtomSpec_t");
    register_vector<molecules_container_t::auto_read_mtz_info_t>("VectorAutoReadMtzInfo_t");
    register_vector<coot::CartesianPair>("VectorCootCartesianPair");
    register_vector<std::vector<coot::CartesianPair>>("VectorVectorCootCartesianPair");
    register_vector<coot::Cartesian>("VectorCootCartesian");
    register_vector<std::vector<coot::Cartesian>>("VectorVectorCootCartesian");
    register_map<unsigned int, std::array<float, 3>>("MapIntFloat3");
    register_map<coot::residue_spec_t, coot::util::density_correlation_stats_info_t>("Map_residue_spec_t_density_correlation_stats_info_t");
    register_vector<std::array<float, 16>>("VectorArrayFloat16");
    register_vector<std::pair<int, int>>("VectorInt_pair");
    register_vector<std::pair<std::string, unsigned int> >("VectorStringUInt_pair");
    register_vector<std::pair<symm_trans_t, Cell_Translation>>("Vectorsym_trans_t_Cell_Translation_pair");
    register_vector<std::pair<std::string, std::string>>("Vectorstring_string_pair");
    register_vector<moorhen_hbond>("Vectormoorhen_hbond");
    register_vector<coot::instanced_geometry_t>("Vectorinstanced_geometry_t");
    register_vector<coot::molecule_t::moved_residue_t>("Vectormoved_residue_t");
    register_vector<coot::molecule_t::moved_atom_t>("Vectormoved_atom_t");
    register_vector<std::string>("VectorString");
    register_vector<std::vector<std::string>>("VectorVectorString");
    register_vector<float>("VectorFloat");
    register_vector<double>("VectorDouble");
    register_vector<int>("VectorInt");
    register_vector<char>("VectorChar");
    register_vector<coot::validation_information_t>("VectorValidationInformation");
    register_vector<std::pair<coot::residue_validation_information_t, coot::residue_validation_information_t> >("VectorResidueValidationInformationPair");
    register_vector<RamachandranInfo>("VectorResidueIdentifier");
    register_vector<ResiduePropertyInfo>("VectorResiduePropertyInfo");
    register_vector<coot::chain_validation_information_t>("Vectorchain_validation_information_t");
    register_vector<coot::residue_validation_information_t>("Vectorresidue_validation_information_t");
    register_vector<coot::simple_rotamer>("Vectorsimple_rotamer");
    register_vector<coot::residue_spec_t>("Vectorresidue_spec_t");
    register_vector<coot::api::vnc_vertex>("Vectorvnc_veertex");
    register_vector<coot::api::vn_vertex>("Vectorvn_vertex");
    register_vector<coot::molecule_t::interesting_place_t>("Vectorinteresting_place_t");
    register_vector<g_triangle>("Vectorg_triangle");
    register_vector<coot::instancing_data_type_A_t>("Vectorinstancing_data_type_A_t");
    register_vector<coot::instancing_data_type_B_t>("Vectorinstancing_data_type_B_t");
    register_vector<std::pair<coot::residue_spec_t,std::string>>("Vectorresidue_spec_t_string_pair");
    register_vector<merge_molecule_results_info_t>("Vectormerge_molecule_results_info_t");
    register_vector<coot::phi_psi_prob_t>("Vectophi_psi_prob_t");
    register_vector<moorhen::h_bond>("Vectorh_bond");

    value_object<coot::util::sfcalc_genmap_stats_t>("sfcalc_genmap_stats_t")
        .field("r_factor",&coot::util::sfcalc_genmap_stats_t::r_factor)
        .field("free_r_factor",&coot::util::sfcalc_genmap_stats_t::free_r_factor)
        .field("bulk_solvent_volume",&coot::util::sfcalc_genmap_stats_t::bulk_solvent_volume)
        .field("bulk_correction",&coot::util::sfcalc_genmap_stats_t::bulk_correction)
        .field("n_splines",&coot::util::sfcalc_genmap_stats_t::n_splines)
    ;

    value_object<molecules_container_t::r_factor_stats>("r_factor_stats")
        .field("r_factor",&molecules_container_t::r_factor_stats::r_factor)
        .field("free_r_factor",&molecules_container_t::r_factor_stats::free_r_factor)
        .field("rail_points_total",&molecules_container_t::r_factor_stats::rail_points_total)
        .field("rail_points_new",&molecules_container_t::r_factor_stats::rail_points_new)
    ;

    value_object<std::pair<int,std::vector<merge_molecule_results_info_t>>>("int_vector_merge_molecule_results_info_t_pair")
        .field("first",&std::pair<int,std::vector<merge_molecule_results_info_t>>::first)
        .field("second",&std::pair<int,std::vector<merge_molecule_results_info_t>>::second)
    ;
    value_object<std::pair<coot::residue_spec_t,std::string>>("residue_spec_t_string_pair")
        .field("first",&std::pair<coot::residue_spec_t,std::string>::first)
        .field("second",&std::pair<coot::residue_spec_t,std::string>::second)
    ;
    value_object<std::pair<symm_trans_t, Cell_Translation>>("sym_trans_t_cell_translation_pair")
        .field("first",&std::pair<symm_trans_t, Cell_Translation>::first)
        .field("second",&std::pair<symm_trans_t, Cell_Translation>::second)
    ;
    value_object<std::pair<std::map<coot::residue_spec_t, coot::util::density_correlation_stats_info_t>,std::map<coot::residue_spec_t, coot::util::density_correlation_stats_info_t>>>("map_residue_spec_t_:density_correlation_stats_info_t_pair")
        .field("first",&std::pair<std::map<coot::residue_spec_t, coot::util::density_correlation_stats_info_t>,std::map<coot::residue_spec_t, coot::util::density_correlation_stats_info_t>>::first)
        .field("second",&std::pair<std::map<coot::residue_spec_t, coot::util::density_correlation_stats_info_t>,std::map<coot::residue_spec_t, coot::util::density_correlation_stats_info_t>>::second)
    ;
    value_object<std::pair<std::string,std::string>>("string_string_pair")
        .field("first",&std::pair<std::string, std::string>::first)
        .field("second",&std::pair<std::string, std::string>::second)
    ;
    value_object<std::pair<int,std::string>>("int_string_pair")
        .field("first",&std::pair<int,std::string>::first)
        .field("second",&std::pair<int,std::string>::second)
    ;
    value_object<std::pair<unsigned int,int>>("uint_int_pair")
        .field("first",&std::pair<unsigned int,int>::first)
        .field("second",&std::pair<unsigned int,int>::second)
    ;
    value_object<std::pair<int,unsigned int>>("int_uint_pair")
        .field("first",&std::pair<int,unsigned int>::first)
        .field("second",&std::pair<int,unsigned int>::second)
    ;
    value_object<std::pair<int,int>>("int_int_pair")
        .field("first",&std::pair<int,int>::first)
        .field("second",&std::pair<int,int>::second)
    ;
    value_object<std::pair<std::string, unsigned int>>("string_uint_pair")
        .field("first",&std::pair<std::string, unsigned int>::first)
        .field("second",&std::pair<std::string, unsigned int>::second)
    ;

    value_object<std::pair<coot::symmetry_info_t,std::vector<std::array<float, 16>>>>("symmetry_info_t_matrixVector_pair")
        .field("first", &std::pair<coot::symmetry_info_t,std::vector<std::array<float, 16>>>::first)
        .field("second",&std::pair<coot::symmetry_info_t,std::vector<std::array<float, 16>>>::second)
    ;

    value_object<std::pair<coot::residue_validation_information_t, coot::residue_validation_information_t>>("residue_validation_information_pair")
        .field("first",  &std::pair<coot::residue_validation_information_t, coot::residue_validation_information_t>::first)
        .field("second", &std::pair<coot::residue_validation_information_t, coot::residue_validation_information_t>::second)
    ;

    value_object<moorhen_hbond>("moorhen_hbond")
      .field("hb_hydrogen",&moorhen_hbond::hb_hydrogen)
      .field("donor",      &moorhen_hbond::donor)
      .field("acceptor",   &moorhen_hbond::acceptor)
      .field("donor_neigh",&moorhen_hbond::donor_neigh)
      .field("acceptor_neigh",&moorhen_hbond::acceptor_neigh)
      .field("angle_1",    &moorhen_hbond::angle_1)
      .field("angle_2",    &moorhen_hbond::angle_2)
      .field("angle_3",    &moorhen_hbond::angle_3)
      .field("dist",       &moorhen_hbond::dist)
      .field("ligand_atom_is_donor",&moorhen_hbond::ligand_atom_is_donor)
      .field("hydrogen_is_ligand_atom",&moorhen_hbond::hydrogen_is_ligand_atom)
      .field("bond_has_hydrogen_flag",&moorhen_hbond::bond_has_hydrogen_flag)
      .field("donor",&moorhen_hbond::donor)
      .field("acceptor",&moorhen_hbond::acceptor)
      .field("donor_neigh",&moorhen_hbond::donor_neigh)
      .field("acceptor_neigh",&moorhen_hbond::acceptor_neigh)
    ;
    value_object<moorhen_hbond::moorhen_hbond_atom>("moorhen_hbond_atom")
      .field("serial",&moorhen_hbond::moorhen_hbond_atom::serial)
      .field("x",&moorhen_hbond::moorhen_hbond_atom::x)
      .field("y",&moorhen_hbond::moorhen_hbond_atom::y)
      .field("z",&moorhen_hbond::moorhen_hbond_atom::z)
      .field("b_iso",&moorhen_hbond::moorhen_hbond_atom::b_iso)
      .field("occ",&moorhen_hbond::moorhen_hbond_atom::occ)
      .field("charge",&moorhen_hbond::moorhen_hbond_atom::charge)
      .field("element",&moorhen_hbond::moorhen_hbond_atom::element)
      .field("name",&moorhen_hbond::moorhen_hbond_atom::name)
      .field("model",&moorhen_hbond::moorhen_hbond_atom::model)
      .field("chain",&moorhen_hbond::moorhen_hbond_atom::chain)
      .field("resNum",&moorhen_hbond::moorhen_hbond_atom::resNum)
      .field("residueName",&moorhen_hbond::moorhen_hbond_atom::residueName)
      .field("altLoc",&moorhen_hbond::moorhen_hbond_atom::altLoc)
    ;

    value_object<std::pair<int,coot::instanced_mesh_t>>("int_instanced_mesh_pair")
        .field("first",&std::pair<int,coot::instanced_mesh_t>::first)
        .field("second",&std::pair<int,coot::instanced_mesh_t>::second)
    ;

    value_array<glm::mat4>("array_mat4")
        .element(emscripten::index<0>())
        .element(emscripten::index<1>())
        .element(emscripten::index<2>())
        .element(emscripten::index<3>())
    ;
     value_array<glm::vec3>("array_float_3")
        .element(emscripten::index<0>())
        .element(emscripten::index<1>())
        .element(emscripten::index<2>())
    ;
    value_array<glm::vec4>("array_float_4")
        .element(emscripten::index<0>())
        .element(emscripten::index<1>())
        .element(emscripten::index<2>())
        .element(emscripten::index<3>())
    ;
    value_array<std::array<unsigned int, 3>>("array_unsigned_int_3")
        .element(emscripten::index<0>())
        .element(emscripten::index<1>())
        .element(emscripten::index<2>())
    ;

    function("getRotamersMap",&getRotamersMap);

    //For testing
    //function("TakeColourMap",&TakeColourMap);
    //function("TakeStringIntPairVector",&TakeStringIntPairVector);
}
