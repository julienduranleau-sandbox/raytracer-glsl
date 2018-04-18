uniform vec2 iResolution;
uniform float iTime;
uniform float iFrame;

#define M_PI 3.1415926535897932384626433832795
#define RAY_MIN 0.0000001
#define RAY_MAX 100000000000.0

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
};

struct Ray {
    vec3 origin;
    vec3 direction;
    RayIntersection intersection;
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

float length2(vec2 v) { return v.x*v.x + v.y*v.y; }
float length2(vec3 v) { return v.x*v.x + v.y*v.y + v.z*v.z; }

vec3 rgb2vec(int r, int g, int b) {
    return vec3(float(r)/255.0, float(g)/255.0, float(b)/255.0);
}

bool intersect(inout Ray ray, Sphere sphere) {
    // Transform ray so we can consider origin-centred sphere
    Ray localRay;
    localRay.origin = ray.origin - sphere.position;
    localRay.direction = ray.direction;

    // Calculate quadratic coefficients
    float a = length2(localRay.direction);
    float b = 2.0 * dot(localRay.direction, localRay.origin);
    float c = length2(localRay.origin) - sphere.radius * sphere.radius;

    // Check whether we intersect
    float discriminant = b * b - 4.0 * a * c;

    if (discriminant < 0.0) {
        return false;
    }

    // Find two points of intersection, t1 close and t2 far
    float t1 = (-b - sqrt(discriminant)) / (2.0 * a);
    float t2 = (-b + sqrt(discriminant)) / (2.0 * a);

    // First check if close intersection is valid
    if (t1 > RAY_MIN && t1 < ray.intersection.t) {
        ray.intersection.t = t1;
        ray.intersection.color = sphere.color;
        return true;
    } else if (t2 > RAY_MAX && t2 < ray.intersection.t) {
        ray.intersection.t = t2;
        ray.intersection.color = sphere.color;
        return true;
    } else {
        // Neither is valid
        return false;
    }
}

bool intersect(inout Ray ray, Plane plane) {
    // First, check if we intersect
    float dDotN = dot(ray.direction, plane.normal);

    if (dDotN == 0.0) {
        // We just assume the ray is not embedded in the plane
        return false;
    }

    // Find point of intersection
    float t = dot(plane.position - ray.origin, plane.normal) / dDotN;

    if (t <= RAY_MIN || t >= ray.intersection.t) {
        // Outside relevant range
        return false;
    }

    ray.intersection.t = t;
    ray.intersection.color = plane.color;

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

Ray createRay(Camera camera) {
    vec2 px = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;
    vec3 xOffset = camera.right * px.x * camera.size.width;
    vec3 yOffset = camera.up * px.y * camera.size.height;
    vec3 rayDirection = camera.forward + xOffset + yOffset;

    RayIntersection intersection = RayIntersection(RAY_MAX, vec3(0.0));
    Ray ray = Ray(camera.origin, rayDirection, intersection);
    return ray;
}

void main() {
    vec3 camOrigin = vec3(0.0, 0.0, 1.0);
    vec3 camTarget = vec3(0.0, 0.0, 0.0);
    vec3 camUpGuide = vec3(0.0, 1.0, 0.0);
    float camFov = 45.0;
    float camAspectRatio = iResolution.x / iResolution.y;
    Camera camera = createCamera(camOrigin, camTarget, camFov, camAspectRatio, camUpGuide);

    Ray ray = createRay(camera);

    Sphere sphere1 = Sphere(vec3(0, 0, -3.0), 1.0, rgb2vec(234, 147, 32));
    Sphere sphere2 = Sphere(vec3(0, 0, -5.0), 2.0, rgb2vec(234, 31, 72));

    Plane plane1 = Plane(vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), rgb2vec(141, 162, 196));

    sphere1.position.x += cos(iTime);
    sphere1.position.z += cos(iTime);
    plane1.position.y += cos(iTime);

    intersect(ray, sphere1);
    intersect(ray, sphere2);
    intersect(ray, plane1);

    gl_FragColor = vec4(ray.intersection.color, 1.0);
 }
