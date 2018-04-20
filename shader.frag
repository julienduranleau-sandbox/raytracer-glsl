uniform vec2 iResolution;
uniform float iTime;
uniform float iFrame;

#define M_PI 3.1415926535897932384626433832795

#define RAY_MIN_LENGTH 0.000000001
#define RAY_MAX_LENGTH 100000000000.0
#define RAY_MAX_DEPTH 5

#define N_SPHERES 2
#define N_PLANES 1
#define N_LIGHTS 2

struct CameraSize {
    float width;
    float height;
};

struct Camera {
    vec3 origin;
    vec3 target;
    vec3 forward;
    vec3 right;
    vec3 up;
    CameraSize size;
};

struct RayIntersection {
    float t;
    vec3 color;
    vec3 normal;
};

struct Ray {
    vec3 origin;
    vec3 direction;
};

struct Sphere {
    vec3 position;
    float radius;
    vec3 color;
};

struct Plane {
    vec3 position;
    vec3 normal;
    vec3 color;
};

struct Light {
    vec3 position;
    vec3 direction;
    vec3 color;
    float force;
};

struct Scene {
    Light lights[N_LIGHTS];
    Sphere spheres[N_SPHERES];
    Plane planes[N_PLANES];
};

vec3 rgb2vec(int r, int g, int b) {
    return vec3(float(r)/255.0, float(g)/255.0, float(b)/255.0);
}

bool intersect(Ray ray, Sphere sphere, inout RayIntersection intersection) {
    // Transform ray so we can consider origin-centred sphere
    Ray localRay;
    localRay.origin = ray.origin - sphere.position;
    localRay.direction = ray.direction;

    // Calculate quadratic coefficients
    float a = dot(localRay.direction, localRay.direction);
    float b = 2.0 * dot(localRay.direction, localRay.origin);
    float c = dot(localRay.origin, localRay.origin) - sphere.radius * sphere.radius;

    // Check whether we intersect
    float discriminant = b * b - 4.0 * a * c;

    if (discriminant < 0.0) {
        return false;
    }

    // Find two points of intersection, t1 close and t2 far
    float t1 = (-b - sqrt(discriminant)) / (2.0 * a);
    float t2 = (-b + sqrt(discriminant)) / (2.0 * a);

    // First check if close intersection is valid
    if (t1 > RAY_MIN_LENGTH && t1 < intersection.t) {
        intersection.t = t1;
        intersection.color = sphere.color;
        intersection.normal = normalize(ray.origin + ray.direction * t1 - sphere.position);
        return true;
    } else {
        // Neither is valid
        return false;
    }
}

bool intersect(Ray ray, Plane plane, inout RayIntersection intersection) {
    // First, check if we intersect
    float dDotN = dot(ray.direction, plane.normal);

    if (dDotN == 0.0) {
        // We just assume the ray is not embedded in the plane
        return false;
    }

    // Find point of intersection
    float t = dot(plane.position - ray.origin, plane.normal) / dDotN;

    if (t <= RAY_MIN_LENGTH || t >= intersection.t) {
        // Outside relevant range
        return false;
    }

    intersection.t = t;
    intersection.color = plane.color;
    intersection.normal = plane.normal;

    return true;
}

Camera createCamera(vec3 origin, vec3 target, float fov, float aspectRatio, vec3 upGuide) {
    Camera camera;

    camera.origin = origin;
    camera.target = target;
    camera.forward = normalize(target - origin);
    camera.right = normalize(cross(camera.forward, upGuide));
    camera.up = normalize(cross(camera.right, camera.forward));
    camera.size.height = tan(radians(fov) * 0.5);
    camera.size.width = camera.size.height * aspectRatio;

    return camera;
}

Ray createRayFromCamera(Camera camera) {
    vec2 px = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;
    vec3 xOffset = camera.right * px.x * camera.size.width;
    vec3 yOffset = camera.up * px.y * camera.size.height;
    vec3 rayDirection = camera.forward + xOffset + yOffset;

    Ray ray = Ray(camera.origin, rayDirection);
    return ray;
}

void trace(Ray ray, Scene scene, out RayIntersection intersection) {
    for (int i = 0; i < N_SPHERES; i++) intersect(ray, scene.spheres[i], intersection);
    for (int i = 0; i < N_PLANES; i++) intersect(ray, scene.planes[i], intersection);
}

void trace(vec3 origin, vec3 direction, Scene scene, out RayIntersection intersection) {
    Ray ray = Ray(origin, direction);
    for (int i = 0; i < N_SPHERES; i++) intersect(ray, scene.spheres[i], intersection);
    for (int i = 0; i < N_PLANES; i++) intersect(ray, scene.planes[i], intersection);
}

vec3 castRay(Ray ray, Scene scene, int depth, vec3 currentColor) {
    if (depth > RAY_MAX_DEPTH) {
        return currentColor;
    }

    RayIntersection intersection = RayIntersection(RAY_MAX_LENGTH, vec3(0.0), vec3(0.0));
    for (int i = 0; i < N_SPHERES; i++) intersect(ray, scene.spheres[i], intersection);
    for (int i = 0; i < N_PLANES; i++) intersect(ray, scene.planes[i], intersection);

    vec3 hitColor = vec3(0.0);

    // https://www.scratchapixel.com/lessons/3d-basic-rendering/ray-tracing-overview/light-transport-ray-tracing-whitted
    // http://www.cs.cornell.edu/courses/cs4620/2012fa/lectures/35raytracing.pdf
    if (intersection.t < RAY_MAX_LENGTH) {
        vec3 hitPoint = ray.origin + ray.direction * intersection.t;

        for (int i = 0; i < N_LIGHTS; i++) {
            // compute shadow ray
            vec3 lightDirection = scene.lights[i].position - hitPoint;
            float dotLightDirection = dot(intersection.normal, normalize(lightDirection));

            float len2 = dot(lightDirection, lightDirection);

            // Phong
            RayIntersection lightIntersection = RayIntersection(RAY_MAX_LENGTH, vec3(0.0), vec3(0.0));
            vec3 lightRayOrigin = hitPoint + (intersection.normal * 0.001);
            trace(lightRayOrigin, normalize(lightDirection), scene, lightIntersection);

            vec3 shadedColor = intersection.color * clamp(dot(intersection.normal, scene.lights[i].direction) * -1.0, 0.0, 1.0);
            if (lightIntersection.t * lightIntersection.t > len2) {
                hitColor += shadedColor;
            }

            // https://youtu.be/GZ_1xOm-3qU?t=391
            // Specular
            vec3 reflectedLightDirection = reflect(-scene.lights[i].direction, intersection.normal);
            float specular = max(0.0, dot(reflectedLightDirection, ray.direction));
            float damping = 0.1;
            hitColor += max(0.0, (specular - damping));
        }
    }

    return hitColor;
}

void fillScene(out Scene scene) {
    scene.spheres[0] = Sphere(vec3(0, 0, -3.0), 1.0, rgb2vec(234, 147, 32));
    scene.spheres[1] = Sphere(vec3(0, 0, -5.0), 2.0, rgb2vec(234, 31, 72));
    scene.planes[0] = Plane(vec3(0.0, -1.0, 0.0), vec3(0.0, 1.0, 0.0), rgb2vec(141, 162, 196));
    scene.lights[0] = Light(vec3(1.0, 4.0, 2.0), vec3(0.0, -1.0, 0.0), vec3(1.0), 1.0);
    scene.lights[1] = Light(vec3(-4.0, 4.0, 2.0), vec3(0.3, -1.0, 0.0), vec3(1.0), 1.0);
}

void main() {
    vec3 camOrigin = vec3(0.0, 0.0, 1.0);
    vec3 camTarget = vec3(0.0, 0.0, 0.0);
    vec3 camUpGuide = vec3(0.0, 1.0, 0.0);
    float camFov = 45.0;
    float camAspectRatio = iResolution.x / iResolution.y;
    Camera camera = createCamera(camOrigin, camTarget, camFov, camAspectRatio, camUpGuide);

    Ray cameraRay = createRayFromCamera(camera);
    Scene scene;
    fillScene(scene);

    scene.spheres[0].position.x += cos(iTime);
    scene.spheres[0].position.z += cos(iTime);
    scene.lights[0].position.x += cos(iTime) * 3.0;
    scene.lights[0].position.y += sin(iTime) * 3.0;
    //scene.planes[0].position.y += cos(iTime);

    vec3 color = castRay(cameraRay, scene, 0, vec3(0.0));

    gl_FragColor = vec4(color, 1.0);
 }
