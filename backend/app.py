import os, math
import argparse
import subprocess
import open3d as o3d
from tqdm import tqdm
from scipy.spatial.transform import Slerp, Rotation
import quaternion
import numpy as np
from utils.read_write_colmap_model import *
from vedo import show, Line, Arrow, Axes, Sphere
from transforms3d.quaternions import qmult, qinverse, qnorm, qlog, qexp


def createPlyColmap(colmap_points):
    xyz = [v.xyz for k, v in colmap_points.items()]
    rgb = [v.rgb/[255, 255, 255] for k, v in colmap_points.items()]
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(xyz)
    pcd.colors = o3d.utility.Vector3dVector(rgb)
    return pcd    

def qvec2rotmat(qvec):
    return np.array([
        [1 - 2 * qvec[2]**2 - 2 * qvec[3]**2,
         2 * qvec[1] * qvec[2] - 2 * qvec[0] * qvec[3],
         2 * qvec[3] * qvec[1] + 2 * qvec[0] * qvec[2]],
        [2 * qvec[1] * qvec[2] + 2 * qvec[0] * qvec[3],
         1 - 2 * qvec[1]**2 - 2 * qvec[3]**2,
         2 * qvec[2] * qvec[3] - 2 * qvec[0] * qvec[1]],
        [2 * qvec[3] * qvec[1] - 2 * qvec[0] * qvec[2],
         2 * qvec[2] * qvec[3] + 2 * qvec[0] * qvec[1],
         1 - 2 * qvec[1]**2 - 2 * qvec[2]**2]])

def rotmat2qvec(R):
    Rxx, Ryx, Rzx, Rxy, Ryy, Rzy, Rxz, Ryz, Rzz = R.flat
    K = np.array([
        [Rxx - Ryy - Rzz, 0, 0, 0],
        [Ryx + Rxy, Ryy - Rxx - Rzz, 0, 0],
        [Rzx + Rxz, Rzy + Ryz, Rzz - Rxx - Ryy, 0],
        [Ryz - Rzy, Rzx - Rxz, Rxy - Ryx, Rxx + Ryy + Rzz]]) / 3.0
    eigvals, eigvecs = np.linalg.eigh(K)
    qvec = eigvecs[[3, 0, 1, 2], np.argmax(eigvals)]
    if qvec[0] < 0:
        qvec *= -1
    return qvec #w x y z

def tq2rotmat(tvec, qvec):
    tvec = np.reshape(tvec, (3,1))
    R = qvec2rotmat(qvec)
    pose = np.hstack((R,tvec))
    c2w = np.vstack((pose, [0,0,0,1]))
    return c2w

def get_background_colour(colour):
    """Converts string to input for open3d visualiser"""
    if colour == "black":
        return [0,0,0]
    elif colour == "white":
        return [255, 255, 255]

def visualise_debugger(newposes, oldposes):
    apexes = [pose[:3, 3] for pose in newposes]
    old_apexes = [pose[:3, 3] for pose in oldposes]

    camera_axes = []
    for pose in newposes:
        origin = pose[:3, 3]
        x_axis = pose[:3, 0] * 0.05
        y_axis = pose[:3, 1] * 0.05
        z_axis = pose[:3, 2] * 0.05

        # Arrows to represent orientation
        camera_axes.extend([
            Arrow(origin, origin + x_axis, c='r'),
            Arrow(origin, origin + y_axis, c='g'),
            Arrow(origin, origin + z_axis, c='b'),
        ])

    # Optionally show the camera positions as small spheres
    camera_apexes = [Sphere(pos, r=0.01, c='blue') for pos in apexes]
    camera_original_apexes = [Sphere(pos, r=0.01, c='yellow') for pos in old_apexes]

    show(camera_apexes, camera_original_apexes, camera_axes)

def custom_draw_geometry_with_camera_trajectory(pcd, poses, width, height, fx, fy, cx, cy, background_color, render_folder):
    # reset state
    custom_draw_geometry_with_camera_trajectory.index = -1
    custom_draw_geometry_with_camera_trajectory.trajectory = poses

    # make sure these dirs really exist
    os.makedirs(f"{render_folder}/image/", exist_ok=True)
    os.makedirs(f"{render_folder}/depth/", exist_ok=True)

    pbar = tqdm(total=len(poses), desc="Creating frames...", unit="frame")

    def move_forward(vis):
        glb = custom_draw_geometry_with_camera_trajectory
        ctr = vis.get_view_control()

        # capture after the first move
        if glb.index >= 0:
            print(f"Capture image {glb.index:05d}")
            vis.capture_depth_image(f"{render_folder}/depth/{glb.index:05d}.png", True)
            vis.capture_screen_image(f"{render_folder}/image/{glb.index:05d}.png", True)

        glb.index += 1
        if glb.index < len(glb.trajectory):
            params = o3d.camera.PinholeCameraParameters()
            params.intrinsic = o3d.camera.PinholeCameraIntrinsic(width, height, fx, fy, cx, cy)
            params.extrinsic = glb.trajectory[glb.index]
            ctr.convert_from_pinhole_camera_parameters(params, True)
            pbar.update(1)
            return True
        else:
            print("Finished")
            pbar.close()
            vis.close()
            return False

    vis = o3d.visualization.Visualizer()
    vis.create_window(visible=True)
    vis.add_geometry(pcd)
    vis.get_render_option().background_color = background_color
    vis.register_animation_callback(move_forward)
    vis.run()
    vis.destroy_window()

def catmul_romm(t0, t1, t2, t3, t=0.5):
    """Translational interpolation for a point exactly in between t1 and t2"""
    return 0.5 *((2 * t1) + (-t0 + t2)*t + (2*t0 - 5*t1 + 4*t2 - t3)*(t**2) + (-t0 + 3*t1- 3*t2 + t3)*(t**3))

def normalise_quaternion(q):
    q = np.array(q, dtype=float)
    return q / np.linalg.norm(q)

def ensure_shortest_path(q1, q2):
    if np.dot(q1, q2) < 0:
        return -q2
    return q2

def squad(q0, q1, q2, q3, t=0.5):
    q0 = normalise_quaternion(q0)
    q1 = normalise_quaternion(q1)
    q2 = normalise_quaternion(q2)
    q3 = normalise_quaternion(q3)

    def intermediate(q_im1, q_i, q_ip1): #quat operations produce w x y z quaternions
        q_i_inv = qinverse(q_i)
        term = qexp(-0.25*(qlog(qmult(q_ip1, q_i)) + qlog(qmult(q_im1, q_i_inv))))
        return qmult(q_i, term)
    #Helper quaternions
    s2 = intermediate(q0, q1, q2)
    s3 = intermediate(q1, q2, q3)

    #SLERP
    def to_scipy_format(q):
        return np.array([q[1], q[2], q[3], q[0]])  # [w,x,y,z] -> [x,y,z,w]
    
    def from_scipy_format(q):
        return np.array([q[3], q[0], q[1], q[2]])  # [x,y,z,w] -> [w,x,y,z]
    
    # Perform SLERP operations using scipy
    q1_scipy = to_scipy_format(q1)
    q2_scipy = to_scipy_format(q2)
    s2_scipy = to_scipy_format(s2)
    s3_scipy = to_scipy_format(s3)
    
    # First level SLERPs
    slerp1 = Slerp([0, 1], Rotation.from_quat([q1_scipy, q2_scipy]))(t)
    slerp2 = Slerp([0, 1], Rotation.from_quat([s2_scipy, s3_scipy]))(t)
    
    # Final SLERP with SQUAD weighting
    final_slerp = Slerp([0, 1], Rotation.from_quat([slerp1.as_quat(), slerp2.as_quat()]))(2*t*(1-t))
    
    # Convert back to [w, x, y, z] format
    result = final_slerp.as_quat()
    return from_scipy_format(result)

    # Scipy implementation
    # slerp_q1q2 = Slerp([0,1], Rotation.from_quat([q1,q2], scalar_first=True))(t)
    # slerp_s2s3   = Slerp([0,1],  Rotation.from_quat([s2,s3], scalar_first=True))(t)
    # slerp_q1q2 = rotmat2qvec(slerp_q1q2.as_matrix())
    # slerp_s2s3 = rotmat2qvec(slerp_s2s3.as_matrix())

    # #My implementation
    # # q1_np = np.quaternion(q1[0], q1[1], q1[2], q1[3])
    # # q2_np = np.quaternion(q2[0], q2[1], q2[2], q2[3])
    # # s2_np = np.quaternion(s2[0], s2[1], s2[2], s2[3])
    # # s3_np = np.quaternion(s3[0], s3[1], s3[2], s3[3])
    # # slerp_q1q2 = quaternion.slerp_evaluate(q1_np,q2_np,0.5)
    # # slerp_s2s3 = quaternion.slerp_evaluate(s2_np,s3_np,0.5)
    # # print(f"Slerp q1q2: {slerp_q1q2}")

    # # final SLERP interpolation
    # return Slerp([0,1], Rotation.from_quat([slerp_q1q2, slerp_s2s3], scalar_first=True))(2*t*(1-t)).as_quat(scalar_first=True)
    # # return slerp(slerp_q1q2, slerp_s2s3, 2*t*(1-t))
    # # return quaternion.slerp_evaluate(slerp_q1q2, slerp_s2s3, 2*t*(1-t))
    
    # # from quaternionic import squad as sq
    # # newq = np.array(sq(np.array([q0, q1, q2, q3]), np.array([0.0, 1.0, 2.0, 3.0]), np.array([1.5]))[0])
    # # return newq

def is_traj_gap(t1, t2, threshold=0.5):
    """Checks if there is a gap that requires interpolation. Assumes metres"""
    if np.linalg.norm(t1-t2) > threshold:
        return True
    return False

def interpolation_alg(poses):
    traj_gap = False
    tvecs = [pose[:3, 3] for pose in poses]
    qvecs = [rotmat2qvec(pose[:3,:3]) for pose in poses]
    assert len(tvecs) == len(qvecs)
    print(len(tvecs))

    newtvecs=[tvecs[0]]
    newqvecs=[qvecs[0]]

    for i in range(len(poses)):
        if len(tvecs[i:i+4]) < 4:
            newtvecs.extend(tvecs[i+1:])
            newqvecs.extend(qvecs[i+1:])
            break
        t0, t1, t2, t3 = tvecs[i:i+4]
        q0, q1, q2, q3 = qvecs[i:i+4]
        newtvecs.append(t1)
        newqvecs.append(q1)
        if is_traj_gap(t1, t2):
            traj_gap = True
            newtvec = catmul_romm(t0, t1, t2, t3)
            newqvec = squad(q0,q1,q2,q3)

            newtvecs.append(newtvec)
            newqvecs.append(newqvec)
    
    assert len(newtvecs) == len(newqvecs)

    #return new poses
    newposes = []
    for i in range(len(newtvecs)):
        c2w = tq2rotmat(newtvecs[i], newqvecs[i])
        newposes.append(c2w)
    return newposes, traj_gap

def interpolate_poses(newposes):
    traj_gap = True
    while traj_gap:
        newposes, traj_gap = interpolation_alg(newposes)

    print(len(newposes))    
    return newposes


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Renders video from input point cloud and poses")
    #Render output
    parser.add_argument("--nseconds", default="60", help="Length of video (s)")
    parser.add_argument("--background_colour", default="black", help="Background colour for video")
    parser.add_argument("--render_image", action="store_true", help="Render rgb video")
    #TODO future add option to get depth video from ffmpeg
    #Input
    parser.add_argument("--colmap_dir", help="Directory to colmap text files")
    #TODO future add support for ply file (not colmap)

    #Load args
    args = parser.parse_args()
    nseconds = int(args.nseconds)
    colmap_dir = args.colmap_dir
    background_colour = get_background_colour(args.background_colour)
    render_image = args.render_image

    #Colmap paths
    cameras_txt = f"{colmap_dir}/cameras.txt"
    images_txt = f"{colmap_dir}/images.txt"
    points3d_txt = f"{colmap_dir}/points3D.txt"
    #Load colmap
    print("Loading colmap info")
    colmap_cameras = read_cameras_text(cameras_txt)
    colmap_images = read_images_text(images_txt)
    colmap_images = dict(sorted(colmap_images.items(), key = lambda kv: int(kv[1].name.split('.')[0].split('_')[1]))) #sort by timestamps
    colmap_points = read_points3D_text(points3d_txt)

    #Load camera information
    key = 1
    camera = colmap_cameras[1]
    width = camera.width
    height = camera.height
    if camera.model == "PINHOLE":
        fx, fy, cx, cy = camera.params
    elif camera.model == "OPENCV":
        fx, fy, cx, cy, k1, k2, p1, p2 = camera.params

    #Load poses
    poses = []
    for k, v in colmap_images.items():
        tvec = v.tvec
        qvec = v.qvec
        pose = tq2rotmat(tvec, qvec)
        poses.append(pose)
    
    #Render snapshots with open3d
    print("Interpolating poses")
    pcd = createPlyColmap(colmap_points)
    out_path = "./outputs/pointcloud.ply"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    o3d.io.write_point_cloud(out_path, pcd, write_ascii=False)
    newposes = interpolate_poses(poses)
    render_folder = './renders'
    custom_draw_geometry_with_camera_trajectory(pcd, newposes, width, height, fx, fy, cx, cy, background_colour, render_folder)

    #Debug visualiser
    # visualise_debugger(newposes, poses)

    #Render video
    base = os.path.abspath(render_folder)
    img_seq = os.path.join(base, "image", "%05d.png")
    depth_seq = os.path.join(base, "depth", "%05d.png")
    os.makedirs("./outputs", exist_ok=True)
    fps = int(len(newposes)/nseconds)
    if render_image:
        print("Rendering video")
        if os.path.exists("./outputs/rgb.mp4"):
            os.remove("./outputs/rgb.mp4")
        cmd = f"ffmpeg -framerate {fps} -i {render_folder}/image/%05d.png -pix_fmt yuv420p ./outputs/rgb.mp4"
        subprocess.run(cmd, shell=True)

    # ######
    # qvecs = [rotmat2qvec(pose[:3,:3]) for pose in poses]
    # q0 = qvecs[50]
    # q1 = qvecs[51]
    # q2 = qvecs[52]
    # q3 = qvecs[53]

    # print(f"My quaternions: {np.array([q0, q1, q2, q3])}")
    # newq_a = squad(q0, q1, q2, q3)
    # print(f"My code: {newq_a}")

    # from quaternionic import squad as sq
    # newq = np.array(sq(np.array([q0, q1, q2, q3]), np.array([0.0, 1.0, 2.0, 3.0]), np.array([1.5]))[0])
    # print(f"Library: {newq}")

    # tvecs = [pose[:3, 3] for pose in poses]
    # newt = catmul_romm(tvecs[50], tvecs[51], tvecs[52], tvecs[53])
    # # newposes = [poses[50], poses[51], tq2rotmat(newt, newq), poses[52], poses[53]]
    # newposes = [poses[50], poses[51], tq2rotmat(newt, newq_a), poses[52], poses[53]]
    # visualise_debugger(newposes, poses[50:54])